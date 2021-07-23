import { URI } from 'foam-core';
import { existsSync } from 'fs';
import * as path from 'path';
import { isAbsolute } from 'path';
import { TextEncoder } from 'util';
import {
  commands,
  ExtensionContext,
  QuickPickItem,
  Selection,
  SnippetString,
  TextDocument,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from 'vscode';
import { FoamFeature } from '../types';
import { focusNote } from '../utils';
import { toVsCodeUri } from '../utils/vsc-utils';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';

const templatesDir = URI.joinPath(
  workspace.workspaceFolders[0].uri,
  '.foam',
  'templates'
);

export class UserCancelledOperation extends Error {
  constructor(message?: string) {
    super('UserCancelledOperation');
    if (message) {
      this.message = message;
    }
  }
}

interface FoamSelectionContent {
  document: TextDocument;
  selection: Selection;
  content: string;
}

const knownFoamVariables = new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT']);

const wikilinkDefaultTemplateText = `# $\{1:\$FOAM_TITLE}\n\n$0`;
const defaultTemplateDefaultText: string = `---
foam_template:
  name: New Note
  description: Foam's default new note template
---
# \${FOAM_TITLE}

\${FOAM_SELECTED_TEXT}
`;
const defaultTemplateUri = URI.joinPath(templatesDir, 'new-note.md');
const dailyNoteTemplateUri = URI.joinPath(templatesDir, 'daily-note.md');

const templateContent = `# \${1:$TM_FILENAME_BASE}

Welcome to Foam templates.

What you see in the heading is a placeholder
- it allows you to quickly move through positions of the new note by pressing TAB, e.g. to easily fill fields
- a placeholder optionally has a default value, which can be some text or, as in this case, a [variable](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_variables)
  - when landing on a placeholder, the default value is already selected so you can easily replace it
- a placeholder can define a list of values, e.g.: \${2|one,two,three|}
- you can use variables even outside of placeholders, here is today's date: \${CURRENT_YEAR}/\${CURRENT_MONTH}/\${CURRENT_DATE}

For a full list of features see [the VS Code snippets page](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax).

## To get started

1. edit this file to create the shape new notes from this template will look like
2. create a note from this template by running the \`Foam: Create New Note From Template\` command
`;

async function templateMetadata(
  templateUri: URI
): Promise<Map<string, string>> {
  const contents = await workspace.fs
    .readFile(toVsCodeUri(templateUri))
    .then(bytes => bytes.toString());
  const [templateMetadata] = extractFoamTemplateFrontmatterMetadata(contents);
  return templateMetadata;
}

async function getTemplates(): Promise<URI[]> {
  const templates = await workspace.findFiles('.foam/templates/**.md', null);
  return templates;
}

async function offerToCreateTemplate(): Promise<void> {
  const response = await window.showQuickPick(['Yes', 'No'], {
    placeHolder:
      'No templates available. Would you like to create one instead?',
  });
  if (response === 'Yes') {
    commands.executeCommand('foam-vscode.create-new-template');
    return;
  }
}

function findFoamVariables(templateText: string): string[] {
  const regex = /\$(FOAM_[_a-zA-Z0-9]*)|\${(FOAM_[[_a-zA-Z0-9]*)}/g;
  var matches = [];
  const output: string[] = [];
  while ((matches = regex.exec(templateText))) {
    output.push(matches[1] || matches[2]);
  }
  const uniqVariables = [...new Set(output)];
  const knownVariables = uniqVariables.filter(x => knownFoamVariables.has(x));
  return knownVariables;
}

async function resolveFoamTitle() {
  const title = await window.showInputBox({
    prompt: `Enter a title for the new note`,
    value: 'Title of my New Note',
    validateInput: value =>
      value.trim().length === 0 ? 'Please enter a title' : undefined,
  });
  if (title === undefined) {
    throw new UserCancelledOperation();
  }
  return title;
}

function resolveFoamSelectedText() {
  return findSelectionContent()?.content ?? '';
}

class Resolver {
  promises = new Map<string, Thenable<string>>();

  resolve(name: string, givenValues: Map<string, string>): Thenable<string> {
    if (givenValues.has(name)) {
      this.promises.set(name, Promise.resolve(givenValues.get(name)));
    } else if (!this.promises.has(name)) {
      switch (name) {
        case 'FOAM_TITLE':
          this.promises.set(name, resolveFoamTitle());
          break;
        case 'FOAM_SELECTED_TEXT':
          this.promises.set(name, Promise.resolve(resolveFoamSelectedText()));
          break;
        default:
          this.promises.set(name, Promise.resolve(name));
          break;
      }
    }
    const result = this.promises.get(name);
    return result;
  }
}

export async function resolveFoamVariables(
  variables: string[],
  givenValues: Map<string, string>
) {
  const resolver = new Resolver();
  const promises = variables.map(async variable =>
    Promise.resolve([variable, await resolver.resolve(variable, givenValues)])
  );

  const results = await Promise.all(promises);

  const valueByName = new Map<string, string>();
  results.forEach(([variable, value]) => {
    valueByName.set(variable, value);
  });

  return valueByName;
}

export function substituteFoamVariables(
  templateText: string,
  givenValues: Map<string, string>
) {
  givenValues.forEach((value, variable) => {
    const regex = new RegExp(
      // Matches a limited subset of the the TextMate variable syntax:
      //  ${VARIABLE}  OR   $VARIABLE
      `\\\${${variable}}|\\$${variable}(\\W|$)`,
      // The latter is more complicated, since it needs to avoid replacing
      // longer variable names with the values of variables that are
      // substrings of the longer ones (e.g. `$FOO` and `$FOOBAR`. If you
      // replace $FOO first, and aren't careful, you replace the first
      // characters of `$FOOBAR`)
      'g' // 'g' => Global replacement (i.e. not just the first instance)
    );
    templateText = templateText.replace(regex, `${value}$1`);
  });

  return templateText;
}

function sortTemplatesMetadata(
  t1: Map<string, string>,
  t2: Map<string, string>
) {
  // Sort by name's existence, then name, then path

  if (t1.get('name') === undefined && t2.get('name') !== undefined) {
    return 1;
  }

  if (t1.get('name') !== undefined && t2.get('name') === undefined) {
    return -1;
  }

  const pathSortOrder = t1
    .get('templatePath')
    .localeCompare(t2.get('templatePath'));

  if (t1.get('name') === undefined && t2.get('name') === undefined) {
    return pathSortOrder;
  }

  const nameSortOrder = t1.get('name').localeCompare(t2.get('name'));

  return nameSortOrder || pathSortOrder;
}

async function askUserForTemplate() {
  const templates = await getTemplates();
  if (templates.length === 0) {
    return offerToCreateTemplate();
  }

  const templatesMetadata = (
    await Promise.all(
      templates.map(async templateUri => {
        const metadata = await templateMetadata(templateUri);
        metadata.set('templatePath', path.basename(templateUri.path));
        return metadata;
      })
    )
  ).sort(sortTemplatesMetadata);

  const items: QuickPickItem[] = await Promise.all(
    templatesMetadata.map(metadata => {
      const label = metadata.get('name') || metadata.get('templatePath');
      const description = metadata.get('name')
        ? metadata.get('templatePath')
        : null;
      const detail = metadata.get('description');
      const item = {
        label: label,
        description: description,
        detail: detail,
      };
      Object.keys(item).forEach(key => {
        if (!item[key]) {
          delete item[key];
        }
      });
      return item;
    })
  );

  return await window.showQuickPick(items, {
    placeHolder: 'Select a template to use.',
  });
}

async function askUserForFilepathConfirmation(
  defaultFilepath: URI,
  defaultFilename: string
) {
  const fsPath = URI.toFsPath(defaultFilepath);
  return await window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: fsPath,
    valueSelection: [fsPath.length - defaultFilename.length, fsPath.length - 3],
    validateInput: value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : existsSync(value)
        ? 'File already exists'
        : undefined,
  });
}

function appendSnippetVariableUsage(templateText: string, variable: string) {
  if (templateText.endsWith('\n')) {
    return `${templateText}\${${variable}}\n`;
  } else {
    return `${templateText}\n\${${variable}}`;
  }
}

export async function resolveFoamTemplateVariables(
  templateText: string,
  extraVariablesToResolve: Set<string> = new Set(),
  givenValues: Map<string, string> = new Map()
): Promise<[Map<string, string>, string]> {
  const variablesInTemplate = findFoamVariables(templateText.toString());
  const variables = variablesInTemplate.concat(...extraVariablesToResolve);
  const uniqVariables = [...new Set(variables)];

  const resolvedValues = await resolveFoamVariables(uniqVariables, givenValues);

  if (
    resolvedValues.get('FOAM_SELECTED_TEXT') &&
    !variablesInTemplate.includes('FOAM_SELECTED_TEXT')
  ) {
    templateText = appendSnippetVariableUsage(
      templateText,
      'FOAM_SELECTED_TEXT'
    );
    variablesInTemplate.push('FOAM_SELECTED_TEXT');
    variables.push('FOAM_SELECTED_TEXT');
    uniqVariables.push('FOAM_SELECTED_TEXT');
  }

  const subbedText = substituteFoamVariables(
    templateText.toString(),
    resolvedValues
  );

  return [resolvedValues, subbedText];
}

async function writeTemplate(
  templateSnippet: SnippetString,
  filepath: URI,
  viewColumn: ViewColumn = ViewColumn.Active
) {
  await workspace.fs.writeFile(
    toVsCodeUri(filepath),
    new TextEncoder().encode('')
  );
  await focusNote(filepath, true, viewColumn);
  await window.activeTextEditor.insertSnippet(templateSnippet);
}

function currentDirectoryFilepath(filename: string) {
  const activeFile = window.activeTextEditor?.document?.uri.path;
  const currentDir =
    activeFile !== undefined
      ? URI.parse(path.dirname(activeFile))
      : workspace.workspaceFolders[0].uri;

  return URI.joinPath(currentDir, filename);
}

function findSelectionContent(): FoamSelectionContent | undefined {
  const editor = window.activeTextEditor;
  if (editor === undefined) {
    return undefined;
  }

  const document = editor.document;
  const selection = editor.selection;

  if (!document || selection.isEmpty) {
    return undefined;
  }

  return {
    document,
    selection,
    content: document.getText(selection),
  };
}

async function replaceSelectionWithWikiLink(
  document: TextDocument,
  newNoteFile: URI,
  selection: Selection
) {
  const newNoteTitle = URI.getFileNameWithoutExtension(newNoteFile);

  const originatingFileEdit = new WorkspaceEdit();
  originatingFileEdit.replace(document.uri, selection, `[[${newNoteTitle}]]`);

  await workspace.applyEdit(originatingFileEdit);
}

function resolveFilepathAttribute(filepath) {
  return isAbsolute(filepath)
    ? URI.file(filepath)
    : URI.joinPath(workspace.workspaceFolders[0].uri, filepath);
}

export function determineDefaultFilepath(
  resolvedValues: Map<string, string>,
  templateMetadata: Map<string, string>,
  fallbackURI: URI = undefined
) {
  let defaultFilepath: URI;
  if (templateMetadata.get('filepath')) {
    defaultFilepath = resolveFilepathAttribute(
      templateMetadata.get('filepath')
    );
  } else if (fallbackURI) {
    return fallbackURI;
  } else {
    const defaultSlug = resolvedValues.get('FOAM_TITLE') || 'New Note';
    defaultFilepath = currentDirectoryFilepath(`${defaultSlug}.md`);
  }
  return defaultFilepath;
}

/**
 * Creates a daily note from the daily note template.
 * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
 * @param templateFallbackText the template text to use if daily-note.md template does not exist. This is configurable by the caller for backwards compatibility purposes.
 */
export async function createNoteFromDailyNoteTemplate(
  filepathFallbackURI: URI,
  templateFallbackText: string
): Promise<void> {
  return await createNoteFromDefaultTemplate(
    new Map(),
    new Set(['FOAM_SELECTED_TEXT']),
    dailyNoteTemplateUri,
    filepathFallbackURI,
    templateFallbackText
  );
}

/**
 * Creates a new note when following a placeholder wikilink using the default template.
 * @param wikilinkPlaceholder the placeholder value from the wikilink. (eg. `[[Hello Joe]]` -> `Hello Joe`)
 * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
 */
export async function createNoteForPlaceholderWikilink(
  wikilinkPlaceholder: string,
  filepathFallbackURI: URI
): Promise<void> {
  return await createNoteFromDefaultTemplate(
    new Map().set('FOAM_TITLE', wikilinkPlaceholder),
    new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT']),
    defaultTemplateUri,
    filepathFallbackURI,
    wikilinkDefaultTemplateText
  );
}

/**
 * Creates a new note using the default note template.
 * @param givenValues already resolved values of Foam template variables. These are used instead of resolving the Foam template variables.
 * @param extraVariablesToResolve Foam template variables to resolve, in addition to those mentioned in the template.
 * @param templateUri the URI of the template to use.
 * @param filepathFallbackURI the URI to use if the template does not specify the `filepath` metadata attribute. This is configurable by the caller for backwards compatibility purposes.
 * @param templateFallbackText the template text to use the default note template does not exist. This is configurable by the caller for backwards compatibility purposes.
 */
async function createNoteFromDefaultTemplate(
  givenValues: Map<string, string> = new Map(),
  extraVariablesToResolve: Set<string> = new Set([
    'FOAM_TITLE',
    'FOAM_SELECTED_TEXT',
  ]),
  templateUri: URI = defaultTemplateUri,
  filepathFallbackURI: URI = undefined,
  templateFallbackText: string = defaultTemplateDefaultText
): Promise<void> {
  const templateText = existsSync(URI.toFsPath(templateUri))
    ? await workspace.fs
        .readFile(toVsCodeUri(templateUri))
        .then(bytes => bytes.toString())
    : templateFallbackText;

  const selectedContent = findSelectionContent();

  let resolvedValues: Map<string, string>,
    templateWithResolvedVariables: string;
  try {
    [
      resolvedValues,
      templateWithResolvedVariables,
    ] = await resolveFoamTemplateVariables(
      templateText,
      extraVariablesToResolve,
      givenValues.set('FOAM_SELECTED_TEXT', selectedContent?.content ?? '')
    );
  } catch (err) {
    if (err instanceof UserCancelledOperation) {
      return;
    } else {
      throw err;
    }
  }

  const [
    templateMetadata,
    templateWithFoamFrontmatterRemoved,
  ] = extractFoamTemplateFrontmatterMetadata(templateWithResolvedVariables);
  const templateSnippet = new SnippetString(templateWithFoamFrontmatterRemoved);

  const defaultFilepath = determineDefaultFilepath(
    resolvedValues,
    templateMetadata,
    filepathFallbackURI
  );
  const defaultFilename = path.basename(defaultFilepath.path);

  let filepath = defaultFilepath;
  if (existsSync(URI.toFsPath(filepath))) {
    const newFilepath = await askUserForFilepathConfirmation(
      defaultFilepath,
      defaultFilename
    );

    if (newFilepath === undefined) {
      return;
    }
    filepath = URI.file(newFilepath);
  }

  await writeTemplate(
    templateSnippet,
    filepath,
    selectedContent ? ViewColumn.Beside : ViewColumn.Active
  );

  if (selectedContent !== undefined) {
    await replaceSelectionWithWikiLink(
      selectedContent.document,
      filepath,
      selectedContent.selection
    );
  }
}

async function createNoteFromTemplate(
  templateFilename?: string
): Promise<void> {
  const selectedTemplate = await askUserForTemplate();
  if (selectedTemplate === undefined) {
    return;
  }
  templateFilename =
    (selectedTemplate as QuickPickItem).description ||
    (selectedTemplate as QuickPickItem).label;
  const templateUri = URI.joinPath(templatesDir, templateFilename);
  const templateText = await workspace.fs
    .readFile(toVsCodeUri(templateUri))
    .then(bytes => bytes.toString());

  const selectedContent = findSelectionContent();

  let resolvedValues, templateWithResolvedVariables;
  try {
    [
      resolvedValues,
      templateWithResolvedVariables,
    ] = await resolveFoamTemplateVariables(
      templateText,
      new Set(['FOAM_SELECTED_TEXT']),
      new Map().set('FOAM_SELECTED_TEXT', selectedContent?.content ?? '')
    );
  } catch (err) {
    if (err instanceof UserCancelledOperation) {
      return;
    } else {
      throw err;
    }
  }

  const [
    templateMetadata,
    templateWithFoamFrontmatterRemoved,
  ] = extractFoamTemplateFrontmatterMetadata(templateWithResolvedVariables);
  const templateSnippet = new SnippetString(templateWithFoamFrontmatterRemoved);

  const defaultFilepath = determineDefaultFilepath(
    resolvedValues,
    templateMetadata
  );
  const defaultFilename = path.basename(defaultFilepath.path);

  const filepath = await askUserForFilepathConfirmation(
    defaultFilepath,
    defaultFilename
  );

  if (filepath === undefined) {
    return;
  }
  const filepathURI = URI.file(filepath);

  await writeTemplate(
    templateSnippet,
    filepathURI,
    selectedContent ? ViewColumn.Beside : ViewColumn.Active
  );

  if (selectedContent !== undefined) {
    await replaceSelectionWithWikiLink(
      selectedContent.document,
      filepathURI,
      selectedContent.selection
    );
  }
}

async function createNewTemplate(): Promise<void> {
  const defaultFilename = 'new-template.md';
  const defaultTemplate = URI.joinPath(templatesDir, defaultFilename);
  const fsPath = URI.toFsPath(defaultTemplate);
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new template`,
    value: fsPath,
    valueSelection: [fsPath.length - defaultFilename.length, fsPath.length - 3],
    validateInput: value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : existsSync(value)
        ? 'File already exists'
        : undefined,
  });
  if (filename === undefined) {
    return;
  }

  const filenameURI = URI.file(filename);
  await workspace.fs.writeFile(
    toVsCodeUri(filenameURI),
    new TextEncoder().encode(templateContent)
  );
  await focusNote(filenameURI, false);
}

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-note-from-template',
        createNoteFromTemplate
      )
    );
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-note-from-default-template',
        createNoteFromDefaultTemplate
      )
    );
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.create-new-template',
        createNewTemplate
      )
    );
  },
};

export default feature;

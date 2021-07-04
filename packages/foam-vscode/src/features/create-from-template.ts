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
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from 'vscode';
import { FoamFeature } from '../types';
import { focusNote } from '../utils';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';

const templatesDir = Uri.joinPath(
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

const defaultTemplateDefaultText: string = `---
foam_template:
  name: New Note
  description: Foam's default new note template
---
# \${FOAM_TITLE}

\${FOAM_SELECTED_TEXT}
`;
const defaultTemplateUri = Uri.joinPath(templatesDir, 'new-note.md');

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
  templateUri: Uri
): Promise<Map<string, string>> {
  const contents = await workspace.fs
    .readFile(templateUri)
    .then(bytes => bytes.toString());
  const [templateMetadata] = extractFoamTemplateFrontmatterMetadata(contents);
  return templateMetadata;
}

async function getTemplates(): Promise<Uri[]> {
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
  defaultFilepath: Uri,
  defaultFilename: string
) {
  return await window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: defaultFilepath.fsPath,
    valueSelection: [
      defaultFilepath.fsPath.length - defaultFilename.length,
      defaultFilepath.fsPath.length - 3,
    ],
    validateInput: value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : existsSync(value)
        ? 'File already exists'
        : undefined,
  });
}

export async function resolveFoamTemplateVariables(
  templateText: string,
  extraVariablesToResolve: Set<string> = new Set(),
  givenValues: Map<string, string> = new Map()
): Promise<[Map<string, string>, string]> {
  const variables = findFoamVariables(templateText.toString()).concat(
    ...extraVariablesToResolve
  );
  const uniqVariables = [...new Set(variables)];

  const missingFoamVariables = [...givenValues.keys()].filter(
    x => uniqVariables.indexOf(x) < 0
  );
  if (missingFoamVariables.includes('FOAM_SELECTED_TEXT')) {
    templateText = `${templateText}
      \${FOAM_SELECTED_TEXT}`;
    uniqVariables.push('FOAM_SELECTED_TEXT');
  }

  if (!givenValues.get('FOAM_SELECTED_TEXT')) {
    givenValues.set('FOAM_SELECTED_TEXT', '');
  }

  const resolvedValues = await resolveFoamVariables(uniqVariables, givenValues);
  const subbedText = substituteFoamVariables(
    templateText.toString(),
    resolvedValues
  );
  return [resolvedValues, subbedText];
}

async function writeTemplate(
  templateSnippet: SnippetString,
  filepath: Uri,
  viewColumn: ViewColumn = ViewColumn.Active
) {
  await workspace.fs.writeFile(filepath, new TextEncoder().encode(''));
  await focusNote(filepath, true, viewColumn);
  await window.activeTextEditor.insertSnippet(templateSnippet);
}

function currentDirectoryFilepath(filename: string) {
  const activeFile = window.activeTextEditor?.document?.uri.path;
  const currentDir =
    activeFile !== undefined
      ? Uri.parse(path.dirname(activeFile))
      : workspace.workspaceFolders[0].uri;

  return Uri.joinPath(currentDir, filename);
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

export function determineDefaultFilepath(
  resolvedValues: Map<string, string>,
  templateMetadata: Map<string, string>
) {
  let defaultFilepath: Uri;
  if (templateMetadata.get('filepath')) {
    const filepathFromMetadata = templateMetadata.get('filepath');
    if (isAbsolute(filepathFromMetadata)) {
      defaultFilepath = Uri.file(filepathFromMetadata);
    } else {
      defaultFilepath = Uri.joinPath(
        workspace.workspaceFolders[0].uri,
        filepathFromMetadata
      );
    }
  } else {
    const defaultSlug = resolvedValues.get('FOAM_TITLE') || 'New Note';
    defaultFilepath = currentDirectoryFilepath(`${defaultSlug}.md`);
  }
  return defaultFilepath;
}

async function createNoteFromDefaultTemplate(): Promise<void> {
  const templateUri = defaultTemplateUri;
  const templateText = existsSync(templateUri.fsPath)
    ? await workspace.fs.readFile(templateUri).then(bytes => bytes.toString())
    : defaultTemplateDefaultText;

  const selectedContent = findSelectionContent();

  let resolvedValues: Map<string, string>,
    templateWithResolvedVariables: string;
  try {
    [
      resolvedValues,
      templateWithResolvedVariables,
    ] = await resolveFoamTemplateVariables(
      templateText,
      new Set(['FOAM_TITLE']),
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

  let filepath = defaultFilepath;
  if (existsSync(filepath.fsPath)) {
    const newFilepath = await askUserForFilepathConfirmation(
      defaultFilepath,
      defaultFilename
    );

    if (newFilepath === undefined) {
      return;
    }
    filepath = Uri.file(newFilepath);
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
  const templateUri = Uri.joinPath(templatesDir, templateFilename);
  const templateText = await workspace.fs
    .readFile(templateUri)
    .then(bytes => bytes.toString());

  const selectedContent = findSelectionContent();

  let resolvedValues, templateWithResolvedVariables;
  try {
    [
      resolvedValues,
      templateWithResolvedVariables,
    ] = await resolveFoamTemplateVariables(
      templateText,
      new Set(),
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
  const filepathURI = Uri.file(filepath);

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
  const defaultTemplate = Uri.joinPath(templatesDir, defaultFilename);
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new template`,
    value: defaultTemplate.fsPath,
    valueSelection: [
      defaultTemplate.fsPath.length - defaultFilename.length,
      defaultTemplate.fsPath.length - 3,
    ],
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

  const filenameURI = Uri.file(filename);
  await workspace.fs.writeFile(
    filenameURI,
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

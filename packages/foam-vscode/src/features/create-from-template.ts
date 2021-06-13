import {
  commands,
  ExtensionContext,
  QuickPickItem,
  SnippetString,
  Uri,
  window,
  workspace,
} from 'vscode';
import * as path from 'path';
import { FoamFeature } from '../types';
import { TextEncoder } from 'util';
import { focusNote } from '../utils';
import { homedir } from 'os';
import { existsSync, readdirSync } from 'fs';
import { isAbsolute } from 'path';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';

export class UserCancelledOperation extends Error {
  constructor(message?: string) {
    super('UserCancelledOperation');
    if (message) {
      this.message = message;
    }
  }
}

const knownFoamVariables = new Set(['FOAM_TITLE']);

const defaultTemplateFilename = 'new-note.md';
const defaultTemplateDefaultText: string = `---
foam_template:
  name: New Note
  description: Foam's default new note template
---
# \${FOAM_TITLE}
`;

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

const homeDir = Uri.file(homedir());
const homeDirTemplatesDir = Uri.joinPath(homeDir, '.foam', 'templates');
const workspaceTemplatesDir = Uri.joinPath(
  workspace.workspaceFolders[0].uri,
  '.foam',
  'templates'
);

function findTemplate(filename: string) {
  return [workspaceTemplatesDir, homeDirTemplatesDir].find(uri =>
    existsSync(Uri.joinPath(uri, filename).fsPath)
  );
}

async function templateMetadata(
  templateUri: Uri
): Promise<Map<string, string>> {
  const contents = await workspace.fs
    .readFile(templateUri)
    .then(bytes => bytes.toString());
  const [templateMetadata] = extractFoamTemplateFrontmatterMetadata(contents);
  return templateMetadata;
}

function getHomeDirTemplates(): Uri[] {
  const homeDirTemplates = existsSync(homeDirTemplatesDir.fsPath)
    ? readdirSync(homeDirTemplatesDir.fsPath, {
        withFileTypes: true,
      })
        .filter(dirent => dirent.isFile && dirent.name.endsWith('.md'))
        .map(dirent => Uri.joinPath(homeDirTemplatesDir, dirent.name))
    : [];
  return homeDirTemplates;
}

function getWorkspaceTemplates(): Thenable<Uri[]> {
  return workspace.findFiles('.foam/templates/**.md', null);
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
  // Sort by name's existence, then name, then basename

  if (t1.get('name') === undefined && t2.get('name') !== undefined) {
    return 1;
  }

  if (t1.get('name') !== undefined && t2.get('name') === undefined) {
    return -1;
  }

  const t1_basename = path.basename(t1.get('templatePath'));
  const t2_basename = path.basename(t1.get('templatePath'));
  const basenameSortOrder = t1_basename.localeCompare(t2_basename);

  if (t1.get('name') === undefined && t2.get('name') === undefined) {
    return basenameSortOrder;
  }

  const nameSortOrder = t1.get('name').localeCompare(t2.get('name'));

  return nameSortOrder || basenameSortOrder;
}

async function templateQuickPickItems(templateUris: Uri[]) {
  const templatesMetadata = (
    await Promise.all(
      templateUris.map(async templateUri => {
        const metadata = await templateMetadata(templateUri);
        metadata.set('templatePath', templateUri.fsPath);
        return metadata;
      })
    )
  ).sort(sortTemplatesMetadata);

  return await Promise.all(
    templatesMetadata.map(metadata => {
      const basename = path.basename(metadata.get('templatePath'));
      const label = metadata.get('name') || basename;
      const description = metadata.get('name') ? basename : null;
      const detail = metadata.get('description');
      const item = {
        label: label,
        description: description,
        detail: detail,
        filepath: metadata.get('templatePath'),
      };
      Object.keys(item).forEach(key => {
        if (!item[key]) {
          delete item[key];
        }
      });
      return item;
    })
  );
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

async function askUserForTemplate() {
  const workspaceTemplates = await getWorkspaceTemplates();

  if (workspaceTemplates.length > 0) {
    const workspaceQuickPicks = await templateQuickPickItems(
      workspaceTemplates
    );

    const selectMore = {
      label: 'Show templates from your home directory',
      description: '',
      detail: homeDirTemplatesDir.fsPath,
      filepath: '',
    };

    workspaceQuickPicks.push(selectMore);

    const workspaceSelection = await window.showQuickPick(workspaceQuickPicks, {
      placeHolder: 'Select a template to use.',
    });

    if (workspaceSelection === undefined || workspaceSelection !== selectMore) {
      return workspaceSelection;
    }
  }

  const homeDirTemplates = getHomeDirTemplates();

  if (homeDirTemplates.length === 0) {
    return offerToCreateTemplate();
  }

  const homeDirQuickPicks = await templateQuickPickItems(homeDirTemplates);

  const homeDirSelection = await window.showQuickPick(homeDirQuickPicks, {
    placeHolder: 'Select a template to use.',
  });

  return homeDirSelection;
}

async function askUserForFilepathConfirmation(
  defaultFilepath: string,
  defaultFilename: string
) {
  const defaultFilepathNoExtension = defaultFilepath.replace(/\.[^.]+$/, '');
  return await window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: defaultFilepath,
    valueSelection: [
      defaultFilepath.length - defaultFilename.length,
      defaultFilepathNoExtension.length,
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
  extraVariablesToResolve: Set<string> = new Set()
): Promise<[Map<string, string>, string]> {
  const givenValues = new Map<string, string>();
  const variables = findFoamVariables(templateText.toString()).concat(
    ...extraVariablesToResolve
  );
  const uniqVariables = [...new Set(variables)];

  const resolvedValues = await resolveFoamVariables(uniqVariables, givenValues);
  const subbedText = substituteFoamVariables(
    templateText.toString(),
    resolvedValues
  );
  return [resolvedValues, subbedText];
}

async function writeTemplate(templateSnippet: SnippetString, filepath: Uri) {
  await workspace.fs.writeFile(filepath, new TextEncoder().encode(''));
  await focusNote(filepath, true);
  await window.activeTextEditor.insertSnippet(templateSnippet);
}

function currentDirectoryFilepath(filename: string): Uri {
  const activeFile = window.activeTextEditor?.document?.uri.path;
  const currentDir =
    activeFile !== undefined
      ? Uri.parse(path.dirname(activeFile))
      : workspace.workspaceFolders[0].uri;

  return Uri.joinPath(currentDir, filename);
}

export function determineDefaultFilepath(
  resolvedValues: Map<string, string>,
  templateMetadata: Map<string, string>
): Uri {
  let defaultFilepath: Uri;
  const filepathFromMetadata = templateMetadata.get('filepath');
  if (filepathFromMetadata) {
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
  const templateUri: Uri | undefined = findTemplate(defaultTemplateFilename);
  const templateText =
    templateUri !== undefined
      ? await workspace.fs.readFile(templateUri).then(bytes => bytes.toString())
      : defaultTemplateDefaultText;

  let resolvedValues: Map<string, string>,
    templateWithResolvedVariables: string;
  try {
    [
      resolvedValues,
      templateWithResolvedVariables,
    ] = await resolveFoamTemplateVariables(
      templateText,
      new Set(['FOAM_TITLE'])
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

  let filepath = defaultFilepath;
  if (existsSync(filepath.fsPath)) {
    const newFilepath = await askUserForFilepathConfirmation(
      filepath.fsPath,
      path.basename(filepath.path)
    );

    if (newFilepath === undefined) {
      return;
    }
    filepath = Uri.file(newFilepath);
  }
  await writeTemplate(templateSnippet, filepath);
}

async function createNoteFromTemplate(
  templateFilepath?: string
): Promise<void> {
  const selectedTemplate = await askUserForTemplate();
  if (selectedTemplate === undefined) {
    return;
  }
  templateFilepath = (selectedTemplate as QuickPickItem)['filepath'];
  const templateUri = Uri.file(templateFilepath);
  const templateText = await workspace.fs
    .readFile(templateUri)
    .then(bytes => bytes.toString());

  let resolvedValues, templateWithResolvedVariables;
  try {
    [
      resolvedValues,
      templateWithResolvedVariables,
    ] = await resolveFoamTemplateVariables(templateText);
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

  const filepath = await askUserForFilepathConfirmation(
    defaultFilepath.fsPath,
    path.basename(defaultFilepath.path)
  );

  if (filepath === undefined) {
    return;
  }
  const filepathUri = Uri.file(filepath);
  await writeTemplate(templateSnippet, filepathUri);
}

function askTemplateCreationLocation(): Thenable<QuickPickItem | undefined> {
  const workspaceQuickPick = {
    label: 'In this workspace',
    description: 'Available for this workspace',
    detail: Uri.joinPath(
      workspace.workspaceFolders[0].uri,
      '.foam',
      'templates'
    ).fsPath,
  };

  const homeDirQuickPick = {
    label: 'In your home directory',
    description: 'Available for all workspaces',
    detail: homeDirTemplatesDir.fsPath,
  };

  const quickPicks = [workspaceQuickPick, homeDirQuickPick];
  return window.showQuickPick(quickPicks, {
    placeHolder: 'Where should the new template be created?',
  });
}

async function createNewTemplate(): Promise<void> {
  const defaultFilename = 'new-template.md';
  const templateLocationSelection = await askTemplateCreationLocation();
  if (templateLocationSelection === undefined) {
    return;
  }

  const defaultFilepath = Uri.joinPath(
    Uri.file((templateLocationSelection as QuickPickItem).detail),
    defaultFilename
  ).fsPath;
  const defaultFilepathNoExtension = defaultFilepath.replace(/\.[^.]+$/, '');
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new template`,
    value: defaultFilepath,
    valueSelection: [
      defaultFilepath.length - defaultFilename.length,
      defaultFilepathNoExtension.length,
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

import {
  window,
  commands,
  ExtensionContext,
  workspace,
  SnippetString,
  Uri,
} from 'vscode';
import * as path from 'path';
import { FoamFeature } from '../types';
import { TextEncoder } from 'util';
import { focusNote } from '../utils';
import { existsSync } from 'fs';

const templatesDir = Uri.joinPath(
  workspace.workspaceFolders[0].uri,
  '.foam',
  'templates'
);

const defaultTemplateDefaultText: string = '# ${FOAM_TITLE}'; // eslint-disable-line no-template-curly-in-string
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

async function getTemplates(): Promise<string[]> {
  const templates = await workspace.findFiles('.foam/templates/**.md');
  return templates.map(template => path.basename(template.path));
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
  return uniqVariables;
}

function resolveFoamTitle() {
  return window.showInputBox({
    prompt: `Enter a title for the new note`,
    value: 'Title of my New Note',
    validateInput: value =>
      value.trim().length === 0 ? 'Please enter a title' : undefined,
  });
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

async function askUserForTemplate() {
  const templates = await getTemplates();
  if (templates.length === 0) {
    return offerToCreateTemplate();
  }
  return await window.showQuickPick(templates, {
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

async function resolveFoamTemplateVariables(
  templateText: string
): Promise<[Map<string, string>, SnippetString]> {
  const givenValues = new Map<string, string>();
  const variables = findFoamVariables(templateText.toString());

  const resolvedValues = await resolveFoamVariables(variables, givenValues);
  const subbedText = substituteFoamVariables(
    templateText.toString(),
    resolvedValues
  );
  const snippet = new SnippetString(subbedText);
  return [resolvedValues, snippet];
}

async function writeTemplate(templateSnippet: SnippetString, filepath: Uri) {
  await workspace.fs.writeFile(filepath, new TextEncoder().encode(''));
  await focusNote(filepath, true);
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

async function createNoteFromDefaultTemplate(): Promise<void> {
  const templateUri = defaultTemplateUri;
  const templateText = existsSync(templateUri.fsPath)
    ? await workspace.fs.readFile(templateUri).then(bytes => bytes.toString())
    : defaultTemplateDefaultText;

  const [resolvedValues, templateSnippet] = await resolveFoamTemplateVariables(
    templateText
  );

  const defaultSlug = resolvedValues.get('FOAM_TITLE') || 'New Note';
  const defaultFilename = `${defaultSlug}.md`;
  const defaultFilepath = currentDirectoryFilepath(defaultFilename);

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
  await writeTemplate(templateSnippet, filepath);
}

async function createNoteFromTemplate(
  templateFilename?: string
): Promise<void> {
  const selectedTemplate = await askUserForTemplate();
  if (selectedTemplate === undefined) {
    return;
  }
  templateFilename = selectedTemplate as string;
  const templateUri = Uri.joinPath(templatesDir, templateFilename);
  const templateText = await workspace.fs
    .readFile(templateUri)
    .then(bytes => bytes.toString());

  const [resolvedValues, templateSnippet] = await resolveFoamTemplateVariables(
    templateText
  );

  const defaultSlug = resolvedValues.get('FOAM_TITLE') || 'New Note';
  const defaultFilename = `${defaultSlug}.md`;
  const defaultFilepath = currentDirectoryFilepath(defaultFilename);

  const filepath = await askUserForFilepathConfirmation(
    defaultFilepath,
    defaultFilename
  );

  if (filepath === undefined) {
    return;
  }
  const filepathURI = Uri.file(filepath);
  await writeTemplate(templateSnippet, filepathURI);
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

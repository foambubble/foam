import {
  window,
  commands,
  ExtensionContext,
  workspace,
  Uri,
  SnippetString,
} from 'vscode';
import * as path from 'path';
import { FoamFeature } from '../types';
import { TextEncoder } from 'util';
import { focusNote } from '../utils';

const templatesDir = `${workspace.workspaceFolders[0].uri.fsPath}/.foam/templates`;
const firstTemplateContent = `# Your new template!

Templates are inserted the same ways snippets are.
This means you get access to [all these good features!](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax).
For example, check out some tabstops in the below list:

- $1
- $2
- $3

To create a note from this template, run the 'Foam: Create new note from template' command.
`;

async function getTemplates(): Promise<string[]> {
  const templates = await workspace.findFiles('.foam/templates/**.md');
  return templates.map(template => path.basename(template.fsPath));
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

async function createNoteFromTemplate(): Promise<void> {
  const templates = await getTemplates();
  if (templates.length === 0) {
    return offerToCreateTemplate();
  }
  const activeFile = window.activeTextEditor?.document?.fileName;
  const currentDir =
    activeFile !== undefined
      ? path.dirname(activeFile)
      : workspace.workspaceFolders[0].uri.fsPath;
  const selectedTemplate = await window.showQuickPick(templates);
  if (selectedTemplate === undefined) {
    return;
  }

  const defaultFileName = 'new-note.md';
  const defaultDir = `${currentDir}${path.sep}${defaultFileName}`;
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: defaultDir,
    valueSelection: [
      defaultDir.length - defaultFileName.length,
      defaultDir.length - 3,
    ],
    validateInput: value =>
      value.length ? undefined : 'Please enter a value!',
  });
  if (filename === undefined) {
    return;
  }

  const templateText = await workspace.fs.readFile(
    Uri.file(`${templatesDir}/${selectedTemplate}`)
  );
  const snippet = new SnippetString(templateText.toString());
  await workspace.fs.writeFile(
    Uri.file(filename),
    new TextEncoder().encode('')
  );
  await focusNote(filename, true);
  await window.activeTextEditor.insertSnippet(snippet);
}

async function createNewTemplate(): Promise<void> {
  const isFirstTemplate = (await getTemplates()).length === 0;
  const defaultFileName = 'new-template.md';
  const templatesDir = path.join(
    workspace.workspaceFolders[0].uri.fsPath,
    '.foam',
    'templates',
    defaultFileName
  );
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new template`,
    value: templatesDir,
    valueSelection: [
      templatesDir.length - defaultFileName.length,
      templatesDir.length - 3,
    ],
    validateInput: value =>
      value.length ? undefined : 'Please enter a value!',
  });
  if (filename === undefined) {
    return;
  }

  const template = isFirstTemplate ? firstTemplateContent : '';
  await workspace.fs.writeFile(
    Uri.file(filename),
    new TextEncoder().encode(template)
  );
  await focusNote(filename, false);
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
        'foam-vscode.create-new-template',
        createNewTemplate
      )
    );
  },
};

export default feature;

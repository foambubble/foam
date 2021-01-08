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

const templatesDir = `${workspace.workspaceFolders[0].uri.path}/.foam/templates`;

async function getTemplates(): Promise<string[]> {
  const templates = await workspace.findFiles('.foam/templates/**.md');
  return templates.map(template => path.basename(template.fsPath));
}

async function createNoteFromTemplate(): Promise<void> {
  const templates = await getTemplates();
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
  const defaultFileName = 'new-template.md';
  const templatesDir = path.join(
    workspace.workspaceFolders[0].uri.fsPath,
    '.foam',
    'templates',
    defaultFileName
  );
  const filename = await window.showInputBox({
    prompt: `Enter the filename for the new note`,
    value: templatesDir,
    valueSelection: [
      templatesDir.length - defaultFileName.length,
      templatesDir.length - 3,
    ],
    validateInput: value =>
      value.length ? undefined : 'Please enter a value!',
  });
  await workspace.fs.writeFile(
    Uri.file(filename),
    new TextEncoder().encode('')
  );
  await focusNote(filename, true);
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

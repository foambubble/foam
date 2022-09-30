import { Selection, workspace } from 'vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import {
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import {
  asAbsoluteWorkspaceUri,
  getCurrentEditorDirectory,
  replaceSelection,
} from './editor';
import { URI } from '../core/model/uri';

describe('Editor utils', () => {
  beforeAll(closeEditors);
  beforeAll(closeEditors);

  describe('getCurrentEditorDirectory', () => {
    it('should return the directory of the active text editor', async () => {
      const file = await createFile('this is the file content.');
      await showInEditor(file.uri);

      expect(getCurrentEditorDirectory()).toEqual(file.uri.getDirectory());
    });

    it('should return the directory of the workspace folder if no editor is open', async () => {
      await closeEditors();
      expect(getCurrentEditorDirectory()).toEqual(
        fromVsCodeUri(workspace.workspaceFolders[0].uri)
      );
    });
  });

  describe('replaceSelection', () => {
    it('should replace the selection in the active editor', async () => {
      const fileA = await createFile('This is the file A');
      const doc = await showInEditor(fileA.uri);
      const selection = new Selection(0, 5, 0, 7); // 'is'

      await replaceSelection(doc.doc, selection, 'was');

      expect(doc.doc.getText()).toEqual('This was the file A');
    });
  });

  describe('asAbsoluteWorkspaceUri', () => {
    it('should work with the VS Code workspace folders if none are passed', () => {
      const uri = URI.file('relative/path');
      const workspaceFolder = workspace.workspaceFolders[0];
      expect(asAbsoluteWorkspaceUri(uri)).toEqual(
        fromVsCodeUri(workspaceFolder.uri).joinPath(uri.path)
      );
    });
  });
});

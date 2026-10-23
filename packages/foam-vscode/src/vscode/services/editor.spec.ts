/* @unit-ready */
import { commands, Selection, window, workspace } from 'vscode';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import {
  closeEditors,
  createFile,
  getActiveTabViewType,
  MARKDOWN_EDITOR_VIEW_TYPE,
  showInEditor,
  withMarkdownEditorAssociation,
} from '../../test/test-utils-vscode';
import {
  asAbsoluteWorkspaceUri,
  getActiveTabUri,
  getCurrentEditorDirectory,
  replaceSelection,
} from './editor';
import { URI } from '@foam/core';

describe('Editor utils', () => {
  beforeAll(closeEditors);
  beforeAll(closeEditors);

  describe('getCurrentEditorDirectory', () => {
    it('should return the directory of the active text editor', async () => {
      const file = await createFile('this is the file content.', [
        'editor-utils',
        'file.md',
      ]);
      await showInEditor(file.uri);

      expect(getCurrentEditorDirectory()).toEqual(file.uri.getDirectory());
    });

    it('should throw if no editor is open', async () => {
      await closeEditors();
      expect(() => getCurrentEditorDirectory()).toThrow();
    });
  });

  describe('replaceSelection', () => {
    it('should replace the selection in the active editor', async () => {
      const fileA = await createFile('This is the file A', [
        'replace-selection',
        'file.md',
      ]);
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

  // Every Foam feature that acts on "the note I am on" — the connections and
  // backlinks panels, the tag views, related notes — reads it from here, so a
  // note opened in an associated editor must not make them go blind.
  // See: https://github.com/foambubble/foam/issues/1742
  describe('getActiveTabUri', () => {
    it('resolves a note open in the editor associated with Markdown', async () => {
      await closeEditors();
      const file = await createFile('# A note', [
        'active-tab',
        'associated.md',
      ]);

      await withMarkdownEditorAssociation(async () => {
        await commands.executeCommand('vscode.open', toVsCodeUri(file.uri));

        expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
        // There is no TextEditor for a custom editor — which is why
        // `getActiveTabUri` reads the tab rather than the active editor, and
        // why VS Code routes no completion or hover into that editor.
        expect(window.activeTextEditor).toBeUndefined();
        expect(getActiveTabUri()).toEqual(file.uri);
      });
    });

    it('resolves a note open in the text editor', async () => {
      await closeEditors();
      const file = await createFile('# A note', ['active-tab', 'plain.md']);

      await commands.executeCommand('vscode.open', toVsCodeUri(file.uri));

      expect(getActiveTabUri()).toEqual(file.uri);
    });
  });
});

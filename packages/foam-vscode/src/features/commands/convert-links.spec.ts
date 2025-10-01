/* @unit-ready */

import * as vscode from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../../test/test-utils-vscode';
import { deleteFile } from '../../services/editor';
import { Logger } from '../../core/utils/log';
import {
  CONVERT_WIKILINK_TO_MDLINK,
  CONVERT_MDLINK_TO_WIKILINK,
} from './convert-links';

Logger.setLevel('error');

describe('Link Conversion Commands', () => {
  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  afterEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  describe('foam-vscode.convert-wikilink-to-markdown', () => {
    it('should convert wikilink to markdown link', async () => {
      const noteA = await createFile('# Note A', ['note-a.md']);
      const { uri } = await createFile('Text before [[note-a]] text after');
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 15, 0, 15);

      await vscode.commands.executeCommand(
        CONVERT_WIKILINK_TO_MDLINK.command
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [Note A](note-a.md) text after');

      await deleteFile(noteA.uri);
      await deleteFile(uri);
    });

    it('should show info message when no wikilink at cursor', async () => {
      const { uri } = await createFile('Text with no wikilinks');
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 5, 0, 5);

      const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      await vscode.commands.executeCommand(
        CONVERT_WIKILINK_TO_MDLINK.command
      );

      expect(showInfoSpy).toHaveBeenCalledWith(
        'No wikilink found at cursor position'
      );

      showInfoSpy.mockRestore();
      await deleteFile(uri);
    });

    it('should show error when resource not found', async () => {
      const { uri } = await createFile(
        'Text before [[nonexistent-file]] text after'
      );
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 20, 0, 20);

      const showErrorSpy = jest
        .spyOn(vscode.window, 'showErrorMessage')
        .mockResolvedValue(undefined);

      Logger.setLevel('off');
      await vscode.commands.executeCommand(
        CONVERT_WIKILINK_TO_MDLINK.command
      );
      Logger.setLevel('error');

      expect(showErrorSpy).toHaveBeenCalled();

      showErrorSpy.mockRestore();
      await deleteFile(uri);
    });
  });

  describe('foam-vscode.convert-markdown-to-wikilink', () => {
    it('should convert markdown link to wikilink', async () => {
      const { uri } = await createFile(
        'Text before [Note A](note-a.md) text after'
      );
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 15, 0, 15);

      await vscode.commands.executeCommand(
        CONVERT_MDLINK_TO_WIKILINK.command
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [[note-a]] text after');

      await deleteFile(uri);
    });

    it('should show info message when no markdown link at cursor', async () => {
      const { uri } = await createFile('Text with no markdown links');
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 5, 0, 5);

      const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      await vscode.commands.executeCommand(
        CONVERT_MDLINK_TO_WIKILINK.command
      );

      expect(showInfoSpy).toHaveBeenCalledWith(
        'No markdown link found at cursor position'
      );

      showInfoSpy.mockRestore();
      await deleteFile(uri);
    });
  });

  describe('Command registration', () => {
    it('should handle no active editor gracefully', async () => {
      await closeEditors();

      await vscode.commands.executeCommand(
        CONVERT_WIKILINK_TO_MDLINK.command
      );
      await vscode.commands.executeCommand(
        CONVERT_MDLINK_TO_WIKILINK.command
      );

      expect(true).toBe(true);
    });
  });
});

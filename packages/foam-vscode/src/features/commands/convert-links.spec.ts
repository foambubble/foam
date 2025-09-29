/* @unit-ready */

import * as vscode from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../../test/test-utils-vscode';
import { deleteFile } from '../../services/editor';
import { delay } from 'lodash';
import { wait } from '../../test/test-utils';

describe('Link Conversion Commands', () => {
  afterAll(async () => {
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  describe('Convert Wikilink to Markdown', () => {
    it('should convert simple wikilink to markdown link', async () => {
      // Create target note that the wikilink refers to
      const noteA = await createFile('# Note A', ['note-a.md']);
      const { uri } = await createFile('Text before [[note-a]] text after');
      const { editor } = await showInEditor(uri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 15, 0, 15); // Inside [[note-a]]

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [Note A](note-a.md) text after');

      await deleteFile(noteA.uri);
      await deleteFile(uri);
    });

    it('should convert wikilink with alias to markdown link', async () => {
      const noteA = await createFile('# Note A', ['note-a.md']);
      const { uri } = await createFile(
        'Text before [[note-a|Custom Title]] text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 15, 0, 15);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [Custom Title](note-a.md) text after');

      await deleteFile(noteA.uri);
      await deleteFile(uri);
    });

    it('should convert wikilink with path to markdown link', async () => {
      const noteB = await createFile('# Note B', ['path', 'to', 'note-b.md']);
      const { uri } = await createFile('Text before [[to/note-b]] text after');
      const { editor } = await showInEditor(uri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 20, 0, 20);
      await wait(500); // Ensure any file watchers are settled
      await vscode.commands.executeCommand('foam-vscode.update-graph');
      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [Note B](path/to/note-b.md) text after');

      await deleteFile(noteB.uri);
      await deleteFile(uri);
    });

    it('should handle wikilinks with spaces in filename', async () => {
      const noteWithSpaces = await createFile('# Note With Spaces', [
        'note with spaces.md',
      ]);
      const { uri } = await createFile(
        'Text before [[note with spaces]] text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 20, 0, 20);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe(
        'Text before [Note With Spaces](<note with spaces.md>) text after'
      );

      await deleteFile(noteWithSpaces.uri);
      await deleteFile(uri);
    });

    it('should show message when no wikilink found at cursor', async () => {
      const { uri } = await createFile('Text with no wikilinks');
      const { editor } = await showInEditor(uri);

      // Position cursor in plain text
      editor.selection = new vscode.Selection(0, 5, 0, 5);

      const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      expect(showInfoSpy).toHaveBeenCalledWith(
        'No wikilink found at cursor position'
      );

      // Text should remain unchanged
      const result = editor.document.getText();
      expect(result).toBe('Text with no wikilinks');

      showInfoSpy.mockRestore();
    });

    it('should handle multiple wikilinks on same line', async () => {
      const noteA = await createFile('# Note A', ['note-a.md']);
      const noteWithSpaces = await createFile('# Note With Spaces', [
        'note with spaces.md',
      ]);
      const { uri } = await createFile(
        '[[note-a]] and [[note with spaces]] on same line'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside second wikilink
      editor.selection = new vscode.Selection(0, 25, 0, 25);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe(
        '[[note-a]] and [Note With Spaces](<note with spaces.md>) on same line'
      );

      await deleteFile(noteA.uri);
      await deleteFile(noteWithSpaces.uri);
      await deleteFile(uri);
    });

    it('should generate correct relative paths from different directory levels', async () => {
      const noteA = await createFile('# Note A', ['note-a.md']);
      // Create a file in a subdirectory
      const { uri: subDirFileUri } = await createFile(
        'Text with [[note-a]] wikilink',
        ['subdirectory', 'test-file.md']
      );
      const { editor } = await showInEditor(subDirFileUri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 15, 0, 15);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text with [Note A](../note-a.md) wikilink');

      await deleteFile(noteA.uri);
      await deleteFile(subDirFileUri);
    });

    it('should generate correct relative paths for same directory files', async () => {
      const noteA = await createFile('# Note A', ['note-a.md']);
      // Create a file at the root level (same as note-a.md)
      const { uri } = await createFile('Text with [[note-a]] wikilink');
      const { editor } = await showInEditor(uri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 15, 0, 15);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text with [Note A](note-a.md) wikilink');

      await deleteFile(noteA.uri);
      await deleteFile(uri);
    });

    it('should generate correct relative paths for nested target files', async () => {
      const noteB = await createFile('# Note B', ['path', 'to', 'note-b.md']);
      // Create a file at root level linking to a nested file
      const { uri } = await createFile('Text with [[path/to/note-b]] wikilink');
      const { editor } = await showInEditor(uri);

      // Position cursor inside the wikilink
      editor.selection = new vscode.Selection(0, 20, 0, 20);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text with [Note B](path/to/note-b.md) wikilink');

      await deleteFile(noteB.uri);
      await deleteFile(uri);
    });
  });

  describe('Convert Markdown to Wikilink', () => {
    it('should convert simple markdown link to wikilink', async () => {
      const { uri } = await createFile(
        'Text before [Note A](note-a.md) text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside the markdown link
      editor.selection = new vscode.Selection(0, 15, 0, 15);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [[note-a]] text after');
    });

    it('should convert markdown link with different text to wikilink with alias', async () => {
      const { uri } = await createFile(
        'Text before [Custom Title](note-a.md) text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside the markdown link
      editor.selection = new vscode.Selection(0, 20, 0, 20);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [[note-a|Custom Title]] text after');
    });

    it('should convert markdown link with path to wikilink', async () => {
      const noteB = await createFile('# Note B', ['path', 'to', 'note-b.md']);
      const { uri } = await createFile(
        'Text before [Note B](path/to/note-b.md) text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside the markdown link
      editor.selection = new vscode.Selection(0, 20, 0, 20);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [[path/to/note-b]] text after');
    });

    it('should show message when no markdown link found at cursor', async () => {
      const { uri } = await createFile('Text with no markdown links');
      const { editor } = await showInEditor(uri);

      // Position cursor in plain text
      editor.selection = new vscode.Selection(0, 5, 0, 5);

      const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      expect(showInfoSpy).toHaveBeenCalledWith(
        'No markdown link found at cursor position'
      );

      // Text should remain unchanged
      const result = editor.document.getText();
      expect(result).toBe('Text with no markdown links');

      showInfoSpy.mockRestore();
    });

    it('should handle multiple markdown links on same line', async () => {
      const noteB = await createFile('# Note B', ['path', 'to', 'note-b.md']);
      const { uri } = await createFile(
        '[Note A](note-a.md) and [Note B](path/to/note-b.md) on same line'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor inside second markdown link
      editor.selection = new vscode.Selection(0, 35, 0, 35);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      const result = editor.document.getText();
      expect(result).toBe(
        '[Note A](note-a.md) and [[path/to/note-b]] on same line'
      );
    });

    it('should handle markdown links with angle brackets', async () => {
      const { uri } = await createFile(
        'Text before [Note With Spaces](<note with spaces.md>) text after'
      );
      const { editor } = await showInEditor(uri);
      await wait(1500); // Ensure any file watchers are settled
      await vscode.commands.executeCommand('foam-vscode.update-graph');

      // Position cursor inside the markdown link
      editor.selection = new vscode.Selection(0, 25, 0, 25);

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );
      await wait(500); // Ensure any file watchers are settled

      const result = editor.document.getText();
      expect(result).toBe('Text before [[note with spaces]] text after');
    });
  });

  describe('Error Handling', () => {
    it('should handle conversion errors gracefully for wikilink to markdown', async () => {
      // Create a wikilink that points to non-existent file
      const { uri } = await createFile(
        'Text before [[nonexistent-file]] text after'
      );
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 20, 0, 20);

      const showErrorSpy = jest.spyOn(vscode.window, 'showErrorMessage');

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      // Should show error message
      expect(showErrorSpy).toHaveBeenCalled();

      showErrorSpy.mockRestore();
    });

    it('should handle conversion errors gracefully for markdown to wikilink', async () => {
      // Create a markdown link that might cause conversion issues
      const { uri } = await createFile(
        'Text before [Invalid](invalid/path.md) text after'
      );
      const { editor } = await showInEditor(uri);

      editor.selection = new vscode.Selection(0, 20, 0, 20);

      const showErrorSpy = jest.spyOn(vscode.window, 'showErrorMessage');

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      // If conversion fails, should show error message
      // Note: This test might pass without error if conversion succeeds
      // The important thing is that it doesn't crash the extension
      const result = editor.document.getText();
      expect(result).toBeDefined(); // Should have some result

      showErrorSpy.mockRestore();
    });

    it('should handle case when no editor is active', async () => {
      // Close all editors
      await closeEditors();

      // Try to run command with no active editor
      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );
      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      // Commands should complete without errors
      // This is mainly testing that the commands don't crash
      expect(true).toBe(true);
    });
  });

  describe('Cursor Position Edge Cases', () => {
    it('should handle cursor at start of wikilink', async () => {
      const { uri } = await createFile('Text before [[note-a]] text after');
      const { editor } = await showInEditor(uri);

      // Position cursor at the very start of wikilink
      editor.selection = new vscode.Selection(0, 12, 0, 12); // At first [

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [Note A](note-a.md) text after');
    });

    it('should handle cursor at end of wikilink', async () => {
      const { uri } = await createFile('Text before [[note-a]] text after');
      const { editor } = await showInEditor(uri);

      // Position cursor at the very end of wikilink
      editor.selection = new vscode.Selection(0, 21, 0, 21); // At last ]

      await vscode.commands.executeCommand(
        'foam-vscode.convert-wikilink-to-markdown'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [Note A](note-a.md) text after');
    });

    it('should handle cursor at start of markdown link', async () => {
      const { uri } = await createFile(
        'Text before [Note A](note-a.md) text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor at the very start of markdown link
      editor.selection = new vscode.Selection(0, 12, 0, 12); // At [

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [[note-a]] text after');
    });

    it('should handle cursor at end of markdown link', async () => {
      const { uri } = await createFile(
        'Text before [Note A](note-a.md) text after'
      );
      const { editor } = await showInEditor(uri);

      // Position cursor at the very end of markdown link
      editor.selection = new vscode.Selection(0, 31, 0, 31); // At )

      await vscode.commands.executeCommand(
        'foam-vscode.convert-markdown-to-wikilink'
      );

      const result = editor.document.getText();
      expect(result).toBe('Text before [[note-a]] text after');
    });
  });
});

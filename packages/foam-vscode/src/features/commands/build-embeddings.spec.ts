/* @unit-ready */
import * as vscode from 'vscode';
import {
  createFile,
  deleteFile,
  waitForNoteInFoamWorkspace,
} from '../../test/test-utils-vscode';
import { BUILD_EMBEDDINGS_COMMAND } from './build-embeddings';
import { wait } from '../../test/test-utils';

describe('build-embeddings command', () => {
  describe('empty workspace', () => {
    it('should complete successfully with no notes to analyze', async () => {
      const showInfoSpy = jest
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue(undefined);

      const result = await vscode.commands.executeCommand<
        'complete' | 'cancelled' | 'error'
      >(BUILD_EMBEDDINGS_COMMAND.command);

      expect(result).toBe('complete');
      expect(showInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('No notes found')
      );

      showInfoSpy.mockRestore();
    });
  });

  describe('successful completion', () => {
    it('should analyze notes and report completion', async () => {
      const note1 = await createFile('# Note 1\nContent here', ['note1.md']);
      const note2 = await createFile('# Note 2\nMore content', ['note2.md']);

      await vscode.commands.executeCommand('foam-vscode-test.reload-workspace');
      await waitForNoteInFoamWorkspace(note1.uri);
      await waitForNoteInFoamWorkspace(note2.uri);

      // Update Foam workspace to discover the new files

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));

      const showInfoSpy = jest
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue(undefined);

      const result = await vscode.commands.executeCommand<
        'complete' | 'cancelled' | 'error'
      >(BUILD_EMBEDDINGS_COMMAND.command);

      expect(result).toBe('complete');
      expect(showInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Analyzed.*2/)
      );

      showInfoSpy.mockRestore();
      await deleteFile(note1.uri);
      await deleteFile(note2.uri);
    });
  });

  describe('cancellation handling', () => {
    it('should return cancelled status when operation is cancelled', async () => {
      const note1 = await createFile('# Note 1\nContent', ['note1.md']);
      await waitForNoteInFoamWorkspace(note1.uri);

      const tokenSource = new vscode.CancellationTokenSource();

      const withProgressSpy = jest
        .spyOn(vscode.window, 'withProgress')
        .mockImplementation(async (options, task) => {
          const progress = { report: () => {} };
          // Cancel immediately
          tokenSource.cancel();
          return await task(progress, tokenSource.token);
        });

      const showInfoSpy = jest
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue(undefined);

      const result = await vscode.commands.executeCommand<
        'complete' | 'cancelled' | 'error'
      >(BUILD_EMBEDDINGS_COMMAND.command);

      expect(result).toBe('cancelled');
      expect(showInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );

      withProgressSpy.mockRestore();
      showInfoSpy.mockRestore();
      await deleteFile(note1.uri);
    });
  });

  describe('command metadata', () => {
    it('should have correct command identifier', () => {
      expect(BUILD_EMBEDDINGS_COMMAND.command).toBe(
        'foam-vscode.build-embeddings'
      );
    });

    it('should have user-friendly title', () => {
      expect(BUILD_EMBEDDINGS_COMMAND.title).toContain('AI');
      expect(BUILD_EMBEDDINGS_COMMAND.title).not.toContain('embedding');
    });
  });
});

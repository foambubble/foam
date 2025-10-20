/* @unit-ready */
import * as vscode from 'vscode';
import {
  createFile,
  deleteFile,
  waitForNoteInFoamWorkspace,
} from '../../test/test-utils-vscode';
import { BUILD_EMBEDDINGS_COMMAND } from './build-embeddings';

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

  describe('concurrent execution deduplication', () => {
    it('should notify user when command is already running', async () => {
      const note1 = await createFile('# Note 1\nContent', ['note1.md']);
      await waitForNoteInFoamWorkspace(note1.uri);

      let firstTaskStarted = false;
      let resolveFirst: any;
      const firstPromise = new Promise(resolve => {
        resolveFirst = resolve;
      });

      const withProgressSpy = jest
        .spyOn(vscode.window, 'withProgress')
        .mockImplementation(async (options, task) => {
          const progress = { report: () => {} };
          const token = new vscode.CancellationTokenSource().token;
          if (!firstTaskStarted) {
            firstTaskStarted = true;
            // Wait for test to release
            await firstPromise;
          }
          return await task(progress, token);
        });

      const showInfoSpy = jest
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue(undefined);

      // Start first command (will block on firstPromise)
      const first = vscode.commands.executeCommand(
        BUILD_EMBEDDINGS_COMMAND.command
      );

      // Wait for first command to actually start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Start second command while first is blocked
      const second = vscode.commands.executeCommand(
        BUILD_EMBEDDINGS_COMMAND.command
      );

      // Wait a bit for second command to detect the running first
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now release the first command
      resolveFirst();

      await Promise.all([first, second]);

      // Should show info message about already running
      expect(showInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('already in progress')
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

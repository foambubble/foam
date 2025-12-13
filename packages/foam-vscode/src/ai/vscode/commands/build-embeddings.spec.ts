/* @unit-ready */
import * as vscode from 'vscode';
import {
  cleanWorkspace,
  createFile,
  deleteFile,
  waitForNoteInFoamWorkspace,
} from '../../../test/test-utils-vscode';
import { BUILD_EMBEDDINGS_COMMAND } from './build-embeddings';

describe('build-embeddings command', () => {
  it('should complete successfully with no notes to analyze', async () => {
    await cleanWorkspace();

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

  it('should analyze notes and report completion', async () => {
    const note1 = await createFile('# Note 1\nContent here', ['note1.md']);
    const note2 = await createFile('# Note 2\nMore content', ['note2.md']);

    await waitForNoteInFoamWorkspace(note1.uri);
    await waitForNoteInFoamWorkspace(note2.uri);

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

import { commands, window } from 'vscode';
import waitForExpect from 'wait-for-expect';
import {
  closeEditors,
  createFile,
  waitForNoteInFoamWorkspace,
} from '../../../test/test-utils-vscode';
import { deleteFile } from '../../services/editor';
import { GO_TO_NOTE_COMMAND, NoteQuickPickItem } from './go-to-note';

describe('go-to-note command', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await closeEditors();
  });

  afterEach(async () => {
    await closeEditors();
  });

  it('opens the note picked from the quick pick (#1792)', async () => {
    const note = await createFile('# Note picked by go-to-note', [
      'go-to-note-target.md',
    ]);
    await waitForNoteInFoamWorkspace(note.uri);

    const spy = vi.spyOn(window, 'showQuickPick').mockImplementationOnce(
      vi.fn((items: NoteQuickPickItem[]) =>
        Promise.resolve(items.find(item => item.uri.path === note.uri.path))
      )
    );

    await commands.executeCommand(GO_TO_NOTE_COMMAND.command);

    await waitForExpect(() => {
      expect(spy).toHaveBeenCalled();
      expect(window.activeTextEditor).toBeTruthy();
      expect(window.activeTextEditor.document.uri.path).toEqual(note.uri.path);
    });

    await deleteFile(note.uri);
  });
});

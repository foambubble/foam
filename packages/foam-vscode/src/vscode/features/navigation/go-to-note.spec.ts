import { commands, window } from 'vscode';
import waitForExpect from 'wait-for-expect';
import {
  closeEditors,
  createFile,
  showInEditor,
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

  it('offers the notes visited in this window first, most recent first (#1792)', async () => {
    const unvisited = await createFile('# Apple', ['go-to-note-apple.md']);
    const visitedEarlier = await createFile('# Mango', ['go-to-note-mango.md']);
    const visitedLast = await createFile('# Zebra', ['go-to-note-zebra.md']);
    for (const note of [unvisited, visitedEarlier, visitedLast]) {
      await waitForNoteInFoamWorkspace(note.uri);
    }
    await showInEditor(visitedEarlier.uri);
    await showInEditor(visitedLast.uri);

    // Opened inside `waitForExpect` because the command reads what the editor
    // events have delivered so far, and they are not guaranteed to have been
    // delivered by the time `showInEditor` resolves.
    await waitForExpect(async () => {
      let offered: NoteQuickPickItem[] = [];
      vi.spyOn(window, 'showQuickPick').mockImplementationOnce(
        vi.fn((items: NoteQuickPickItem[]) => {
          offered = items;
          return Promise.resolve(undefined);
        })
      );

      await commands.executeCommand(GO_TO_NOTE_COMMAND.command);

      const offeredAt = (uri: { path: string }) =>
        offered.findIndex(item => item.uri.path === uri.path);
      // The note the user is on comes first, the one before it next, and the
      // note that was never opened sits in the alphabetical tail — even though
      // its title sorts ahead of both.
      expect(offeredAt(visitedLast.uri)).toEqual(0);
      expect(offeredAt(visitedEarlier.uri)).toEqual(1);
      expect(offeredAt(visitedEarlier.uri)).toBeLessThan(
        offeredAt(unvisited.uri)
      );
    });

    await deleteFile(unvisited.uri);
    await deleteFile(visitedEarlier.uri);
    await deleteFile(visitedLast.uri);
  });
});

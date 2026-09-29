import * as fs from 'fs';
import * as path from 'path';
import {
  getUriInWorkspace,
  waitForNoteInFoamWorkspace,
  waitForNoteRemovedFromFoamWorkspace,
} from '../../test/test-utils-vscode';
import { randomString, wait } from '../../test/test-utils';

/**
 * VS Code reports a folder moved or renamed as a single event for the folder,
 * without events for the files inside it. The folders here are changed with
 * Node's fs, as a terminal, a file manager or git would do, rather than
 * through VS Code.
 */
describe('Watching folders changed outside VS Code', () => {
  it('indexes the notes in a folder moved into the workspace', async () => {
    const name = `moved-in-${randomString()}`;
    const folder = getUriInWorkspace(name);
    // Outside the workspace folder, on the same file system so rename works
    const outside = path.join(folder.toFsPath(), '..', '..', `.${name}`);
    const note = folder.joinPath('note.md');
    try {
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, 'note.md'), '# Note');
      fs.renameSync(outside, folder.toFsPath());

      await waitForNoteInFoamWorkspace(note);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
      fs.rmSync(folder.toFsPath(), { recursive: true, force: true });
    }
  });

  it('re-indexes the notes in a renamed folder', async () => {
    const before = getUriInWorkspace(`renamed-${randomString()}`);
    const after = getUriInWorkspace(`renamed-${randomString()}`);
    const noteBefore = before.joinPath('note.md');
    const noteAfter = after.joinPath('note.md');
    try {
      fs.mkdirSync(before.toFsPath());
      // Let the watcher pick up the folder, so the note's own event is seen
      await wait(1000);
      fs.writeFileSync(noteBefore.toFsPath(), '# Note');
      await waitForNoteInFoamWorkspace(noteBefore);

      fs.renameSync(before.toFsPath(), after.toFsPath());

      await waitForNoteInFoamWorkspace(noteAfter);
      await waitForNoteRemovedFromFoamWorkspace(noteBefore);
    } finally {
      fs.rmSync(before.toFsPath(), { recursive: true, force: true });
      fs.rmSync(after.toFsPath(), { recursive: true, force: true });
    }
  });
});

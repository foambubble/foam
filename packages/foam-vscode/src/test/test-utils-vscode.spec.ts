import {
  createFile,
  deleteFile,
  getFoamFromVSCode,
  getUriInWorkspace,
  waitForNoteInFoamWorkspace,
} from './test-utils-vscode';
import { randomString } from './test-utils';

describe('deleteFile', () => {
  it('resolves once the Foam workspace no longer lists the note', async () => {
    const note = await createFile('# Note');
    await waitForNoteInFoamWorkspace(note.uri);

    await deleteFile(note);

    const foam = await getFoamFromVSCode();
    expect(foam.workspace.find(note.uri)).toBeNull();
  });

  it('resolves once the Foam workspace no longer lists the notes in a deleted folder', async () => {
    const folder = `folder-${randomString()}`;
    const note = await createFile('# Note', [folder, 'note.md']);
    await waitForNoteInFoamWorkspace(note.uri);

    await deleteFile(getUriInWorkspace(folder));

    const foam = await getFoamFromVSCode();
    expect(foam.workspace.find(note.uri)).toBeNull();
  });
});

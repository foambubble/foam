/* @unit-ready */
import { commands, window } from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  deleteFile,
  getActiveTabViewType,
  MARKDOWN_EDITOR_VIEW_TYPE,
  waitForNoteInFoamWorkspace,
  withMarkdownEditorAssociation,
} from '../../../test/test-utils-vscode';

describe('open-random-note command', () => {
  // The command refuses to run with fewer than two notes.
  const createTwoNotes = async () => {
    const noteA = await createFile('# Note A');
    const noteB = await createFile('# Note B');
    await waitForNoteInFoamWorkspace(noteA.uri);
    await waitForNoteInFoamWorkspace(noteB.uri);
    return [noteA.uri, noteB.uri];
  };

  afterAll(async () => {
    await cleanWorkspace();
  });

  it('opens the note in the editor associated with Markdown (#1742)', async () => {
    await closeEditors();
    const notes = await createTwoNotes();

    await withMarkdownEditorAssociation(async () => {
      await commands.executeCommand('foam-vscode.open-random-note');

      expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
    });

    await closeEditors();
    await Promise.all(notes.map(deleteFile));
  });

  it('opens the note in the text editor when nothing is associated with Markdown (#1742)', async () => {
    await closeEditors();
    const notes = await createTwoNotes();

    await commands.executeCommand('foam-vscode.open-random-note');

    expect(getActiveTabViewType()).toBeUndefined();
    expect(window.activeTextEditor.document.uri.path).toMatch(/\.md$/);

    await closeEditors();
    await Promise.all(notes.map(deleteFile));
  });
});

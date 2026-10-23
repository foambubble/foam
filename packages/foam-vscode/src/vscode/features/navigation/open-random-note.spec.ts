/* @unit-ready */
import { commands, window } from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  getActiveTabViewType,
  MARKDOWN_EDITOR_VIEW_TYPE,
  waitForNoteInFoamWorkspace,
  withMarkdownEditorAssociation,
} from '../../../test/test-utils-vscode';

// Two notes in each case: the command refuses to run with fewer than two.
describe('open-random-note command', () => {
  beforeEach(async () => {
    await closeEditors();
  });

  afterAll(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  it('opens the note in the editor associated with Markdown (#1742)', async () => {
    const noteA = await createFile('# Note A');
    const noteB = await createFile('# Note B');
    await waitForNoteInFoamWorkspace(noteA.uri);
    await waitForNoteInFoamWorkspace(noteB.uri);

    await withMarkdownEditorAssociation(async () => {
      await commands.executeCommand('foam-vscode.open-random-note');

      expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
    });
  });

  it('opens the note in the text editor when nothing is associated with Markdown', async () => {
    const noteA = await createFile('# Note A');
    const noteB = await createFile('# Note B');
    await waitForNoteInFoamWorkspace(noteA.uri);
    await waitForNoteInFoamWorkspace(noteB.uri);

    await commands.executeCommand('foam-vscode.open-random-note');

    expect(getActiveTabViewType()).toBeUndefined();
    expect(window.activeTextEditor.document.uri.path).toMatch(/\.md$/);
  });
});

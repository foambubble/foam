/* @unit-ready */

import { wait, waitForExpect } from '../test/test-utils';
import {
  closeEditors,
  createFile,
  cleanWorkspace,
  readFile,
  renameFile,
  showInEditor,
  runCommand,
  deleteFile,
} from '../test/test-utils-vscode';
import { UPDATE_GRAPH_COMMAND_NAME } from './commands/update-graph';

describe('Note rename sync', () => {
  beforeAll(async () => {
    await closeEditors();
    await cleanWorkspace();
  });
  afterAll(closeEditors);

  describe('wikilinks', () => {
    it('should sync wikilinks to renamed notes', async () => {
      const noteA = await createFile(`Content of note A`, [
        'refactor',
        'wikilinks',
        'rename-note-a.md',
      ]);
      const noteB = await createFile(
        `Link to [[${noteA.name}]]. Also a [[placeholder]] and again [[${noteA.name}]]`,
        ['refactor', 'wikilinks', 'rename-note-b.md']
      );
      const noteC = await createFile(`Link to [[${noteA.name}]] from note C.`, [
        'refactor',
        'wikilinks',
        'rename-note-c.md',
      ]);
      const { doc } = await showInEditor(noteB.uri);

      const newName = 'renamed-note-a';
      const newUri = noteA.uri.resolve(newName);

      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        // check it updates documents open in editors
        expect(doc.getText().trim()).toEqual(
          `Link to [[${newName}]]. Also a [[placeholder]] and again [[${newName}]]`
        );
        // and documents not open in editors
        expect((await readFile(noteC.uri)).trim()).toEqual(
          `Link to [[${newName}]] from note C.`
        );
      }, 1000);

      await deleteFile(newUri);
      await deleteFile(noteB.uri);
      await deleteFile(noteC.uri);
    });

    it('should sync when moving the note to a new folder', async () => {
      const noteA = await createFile(`Content of note A`, [
        'refactor',
        'first',
        'note-a.md',
      ]);
      const noteC = await createFile(`Link to [[note-a]] from note C.`);

      const newUri = noteA.uri.resolve('../note-a.md');
      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);

      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        const content = await readFile(noteC.uri);
        expect(content.trim()).toEqual(`Link to [[note-a]] from note C.`);
      });
      await deleteFile(newUri);
      await deleteFile(noteC.uri);
    });
  });

  describe('directory renames', () => {
    it('should sync qualified wikilinks when a folder is renamed', async () => {
      // note-a exists in two folders, forcing a qualified [[folderA/note-a]] link
      const noteA = await createFile('Content of A', [
        'dir-rename',
        'folderA',
        'note-a.md',
      ]);
      const otherNote = await createFile('Conflicting note', [
        'dir-rename',
        'other',
        'note-a.md',
      ]);
      const outside = await createFile('Link to [[folderA/note-a]]', [
        'dir-rename',
        'outside.md',
      ]);

      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);

      const folderAUri = noteA.uri.getDirectory();
      const folderBUri = folderAUri.getDirectory().joinPath('folderB');
      await renameFile(folderAUri, folderBUri);

      await waitForExpect(async () => {
        expect((await readFile(outside.uri)).trim()).toEqual(
          'Link to [[folderB/note-a]]'
        );
      }, 1000);

      await deleteFile(outside.uri);
      await deleteFile(folderBUri);
      await deleteFile(otherNote.uri);
    });

    it('should not change unique wikilinks when a folder is renamed', async () => {
      // unique-note has no basename conflict — identifier stays [[unique-note]]
      const noteA = await createFile('Content of A', [
        'dir-rename-unique',
        'folderA',
        'unique-note.md',
      ]);
      const outside = await createFile('Link to [[unique-note]]', [
        'dir-rename-unique',
        'outside.md',
      ]);

      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);

      const folderAUri = noteA.uri.getDirectory();
      const folderBUri = folderAUri.getDirectory().joinPath('folderB');
      await renameFile(folderAUri, folderBUri);

      await waitForExpect(async () => {
        expect((await readFile(outside.uri)).trim()).toEqual(
          'Link to [[unique-note]]'
        );
      }, 1000);

      await deleteFile(outside.uri);
      await deleteFile(folderBUri);
    });
  });

  describe('direct links', () => {
    beforeAll(async () => {
      await closeEditors();
      await cleanWorkspace();
    });
    beforeEach(closeEditors);

    it('should not update markdown links on rename (delegated to VS Code built-in) - #1069', async () => {
      const originalLink = `Link to [note](../f1/note-a.md) from note B.`;
      const noteA = await createFile(
        `Content of note A. Lorem etc etc etc etc`,
        ['refactor', 'direct-links', 'f1', 'note-a.md']
      );
      const noteB = await createFile(originalLink, [
        'refactor',
        'direct-links',
        'f2',
        'note-b.md',
      ]);
      const { doc } = await showInEditor(noteB.uri);

      const newUri = noteA.uri.resolve('../note-a.md');
      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      // Foam does not update markdown links; the link should remain unchanged
      await wait(500);
      expect(doc.getText().trim()).toEqual(originalLink);

      await deleteFile(newUri);
      await deleteFile(noteB.uri);
    });
  });
});

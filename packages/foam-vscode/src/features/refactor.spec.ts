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
      }, 3000);

      await deleteFile(newUri);
      await deleteFile(noteB.uri);
      await deleteFile(noteC.uri);
    });

    it('should use the best identifier based on the new note location', async () => {
      const noteA = await createFile(`Content of note A`, [
        'refactor',
        'wikilink',
        'first',
        'note-a.md',
      ]);
      await createFile(`Content of note B`, [
        'refactor',
        'wikilink',
        'second',
        'note-b.md',
      ]);
      const noteC = await createFile(`Link to [[${noteA.name}]] from note C.`);

      const { doc } = await showInEditor(noteC.uri);

      // rename note A
      const newUri = noteA.uri.resolve('note-b.md');

      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        expect(doc.getText().trim()).toEqual(
          `Link to [[first/note-b]] from note C.`
        );
      }, 3000);
      await deleteFile(newUri);
      await deleteFile(noteC.uri);
    });

    it('should use the best identifier when moving the note to another directory', async () => {
      const noteA = await createFile(`Content of note A`, [
        'refactor',
        'wikilink',
        'first',
        'note-a.md',
      ]);
      await createFile(`Content of note B`, [
        'refactor',
        'wikilink',
        'second',
        'note-b.md',
      ]);
      const noteC = await createFile(`Link to [[${noteA.name}]] from note C.`);

      const { doc } = await showInEditor(noteC.uri);

      const newUri = noteA.uri.resolve('../second/note-a.md');

      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        expect(doc.getText().trim()).toEqual(`Link to [[note-a]] from note C.`);
      });
      await deleteFile(newUri);
      await deleteFile(noteC.uri);
    });

    it('should keep the alias in wikilinks', async () => {
      const noteA = await createFile(`Content of note A`, ['note-a.md']);
      const noteB = await createFile(`Link to [[note-a|Alias]]`, ['note-b.md']);

      const { doc } = await showInEditor(noteB.uri);

      // rename note A
      const newUri = noteA.uri.resolve('new-note-a.md');
      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        expect(doc.getText().trim()).toEqual(`Link to [[new-note-a|Alias]]`);
      });
      await deleteFile(newUri);
      await deleteFile(noteB.uri);
    });

    it('should keep the section part of the wikilink', async () => {
      const noteA = await createFile(`Content of note A`);
      const noteB = await createFile(`Link to [[${noteA.name}#Section]]`);

      const { doc } = await showInEditor(noteB.uri);

      // rename note A
      const newUri = noteA.uri.resolve('new-note-with-section.md');
      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        expect(doc.getText().trim()).toEqual(
          `Link to [[new-note-with-section#Section]]`
        );
      });
      await deleteFile(newUri);
      await deleteFile(noteB.uri);
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

  describe('direct links', () => {
    beforeAll(async () => {
      await closeEditors();
      await cleanWorkspace();
    });
    beforeEach(closeEditors);

    it('should rename relative direct links', async () => {
      const noteA = await createFile(
        `Content of note A. Lorem etc etc etc etc`,
        ['refactor', 'direct-links', 'f1', 'note-a.md']
      );
      const noteB = await createFile(
        `Link to [note](../f1/note-a.md) from note B.`,
        ['refactor', 'direct-links', 'f2', 'note-b.md']
      );
      const { doc } = await showInEditor(noteB.uri);

      const newUri = noteA.uri.resolve('../note-a.md');
      // wait for the rename events to be propagated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);
      await renameFile(noteA.uri, newUri);

      await waitForExpect(async () => {
        expect(doc.getText().trim()).toEqual(
          `Link to [note](../note-a.md) from note B.`
        );
      });

      await deleteFile(newUri);
      await deleteFile(noteB.uri);
    });
  });
});

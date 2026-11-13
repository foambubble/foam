/* @unit-ready */
import * as vscode from 'vscode';
import { createMarkdownParser, FoamGraph } from '@foam/core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  deleteFile,
  getFoamFromVSCode,
  readFile,
  showInEditor,
  waitForNoteInFoamWorkspace,
} from '../../../test/test-utils-vscode';
import { createTestWorkspace, waitForExpect } from '../../../test/test-utils';
import { NoteRenameProvider } from './note-rename-provider';

const parser = createMarkdownParser([]);

const buildFoamLike = (ws: ReturnType<typeof createTestWorkspace>) => ({
  workspace: ws,
  graph: FoamGraph.fromWorkspace(ws),
  services: { parser },
  dispose: () => {},
});

describe('NoteRenameProvider', () => {
  describe('prepareRename', () => {
    beforeEach(async () => {
      await cleanWorkspace();
      await closeEditors();
    });

    it('should return the target of a wikilink and its name as placeholder', async () => {
      const fileA = await createFile('# Note A\n', ['note-a.md']);
      const fileB = await createFile(`See [[${fileA.name}]].\n`);

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const provider = new NoteRenameProvider(buildFoamLike(ws) as any);

      const { doc } = await showInEditor(fileB.uri);
      const result = (await provider.prepareRename(
        doc,
        new vscode.Position(0, 'See [[no'.length),
        new vscode.CancellationTokenSource().token
      )) as { range: vscode.Range; placeholder: string };

      const start = 'See [['.length;
      expect(result.placeholder).toBe(fileA.name);
      expect(result.range).toEqual(
        new vscode.Range(0, start, 0, start + fileA.name.length)
      );
    });

    it('should throw when the cursor is on the section of a wikilink', async () => {
      const fileA = await createFile('# Note A\n\n## Goals\n', ['note-a.md']);
      const fileB = await createFile(`See [[${fileA.name}#Goals]].\n`);

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const provider = new NoteRenameProvider(buildFoamLike(ws) as any);

      const { doc } = await showInEditor(fileB.uri);
      await expect(
        provider.prepareRename(
          doc,
          new vscode.Position(0, `See [[${fileA.name}#Go`.length),
          new vscode.CancellationTokenSource().token
        )
      ).rejects.toThrow('Cannot rename: cursor is not on a note');
    });

    it('should throw when the wikilink has no note behind it', async () => {
      const fileB = await createFile('See [[no-such-note]].\n');

      const ws = createTestWorkspace().set(
        parser.parse(fileB.uri, fileB.content)
      );
      const provider = new NoteRenameProvider(buildFoamLike(ws) as any);

      const { doc } = await showInEditor(fileB.uri);
      await expect(
        provider.prepareRename(
          doc,
          new vscode.Position(0, 'See [[no-s'.length),
          new vscode.CancellationTokenSource().token
        )
      ).rejects.toThrow('Cannot rename: cursor is not on a note');
    });
  });

  describe('provideRenameEdits', () => {
    beforeAll(async () => {
      await closeEditors();
      await cleanWorkspace();
    });
    afterAll(closeEditors);

    it('should rename the note and leave every link pointing at it', async () => {
      const noteA = await createFile('# Note A\n', [
        'note-rename',
        'target-note.md',
      ]);
      const noteB = await createFile(
        `Wiki [[${noteA.name}]] and md [text](./target-note.md).`,
        ['note-rename', 'linking-note.md']
      );
      await Promise.all(
        [noteA, noteB].map(n => waitForNoteInFoamWorkspace(n.uri))
      );
      const foam = await getFoamFromVSCode();
      foam.graph.update();

      const { doc } = await showInEditor(noteB.uri);
      const provider = new NoteRenameProvider(foam);
      const edits = await provider.provideRenameEdits(
        doc,
        new vscode.Position(0, 'Wiki [[ta'.length),
        'renamed-note',
        new vscode.CancellationTokenSource().token
      );
      await vscode.workspace.applyEdit(edits);

      const renamedUri = noteA.uri.withName('renamed-note');
      await waitForExpect(async () => {
        // The file moved, keeping its folder and extension
        expect(await readFile(renamedUri)).toContain('# Note A');
        // The wikilink followed it; the markdown link is VS Code's to update
        expect((await readFile(noteB.uri)).trim()).toEqual(
          'Wiki [[renamed-note]] and md [text](./target-note.md).'
        );
      }, 2000);

      await deleteFile(renamedUri);
      await deleteFile(noteB.uri);
    });
  });
});

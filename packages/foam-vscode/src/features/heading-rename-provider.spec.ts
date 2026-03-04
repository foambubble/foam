import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamGraph } from '../core/model/graph';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { createTestWorkspace } from '../test/test-utils';
import { toVsCodeUri } from '../utils/vsc-utils';
import { HeadingRenameProvider } from './heading-rename-provider';

const parser = createMarkdownParser([]);

const buildFoamLike = (ws: ReturnType<typeof createTestWorkspace>) => ({
  workspace: ws,
  graph: FoamGraph.fromWorkspace(ws),
  dispose: () => {},
});

describe('HeadingRenameProvider', () => {
  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  describe('prepareRename', () => {
    it('should return the heading label range and placeholder when cursor is on a heading', async () => {
      const fileA = await createFile('# My Heading\n\nSome content here.\n');

      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const foam = buildFoamLike(ws);
      const provider = new HeadingRenameProvider(foam as any);

      const { doc } = await showInEditor(fileA.uri);

      const result = (await provider.prepareRename(
        doc,
        new vscode.Position(0, 5),
        new vscode.CancellationTokenSource().token
      )) as { range: vscode.Range; placeholder: string };

      expect(result.placeholder).toBe('My Heading');
      expect(result.range.start.character).toBe(2); // after "# "
      expect(result.range.end.character).toBe(12); // "My Heading".length = 10, start=2, end=12
    });

    it('should throw when cursor is not on a heading line', async () => {
      const fileA = await createFile('# My Heading\n\nSome body text.\n');

      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const foam = buildFoamLike(ws);
      const provider = new HeadingRenameProvider(foam as any);

      const { doc } = await showInEditor(fileA.uri);

      await expect(
        provider.prepareRename(
          doc,
          new vscode.Position(2, 0),
          new vscode.CancellationTokenSource().token
        )
      ).rejects.toThrow('Cannot rename: cursor is not on a heading');
    });
  });

  describe('provideRenameEdits', () => {
    it('should update the heading text and all wikilinks referencing it', async () => {
      const fileA = await createFile('# Old Heading\n\nContent.\n');
      const fileB = await createFile(
        `# Note B\n\nSee [[${fileA.name}#Old Heading]] for more.\n`
      );

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const foam = buildFoamLike(ws);
      const provider = new HeadingRenameProvider(foam as any);

      const { doc } = await showInEditor(fileA.uri);
      const edits = await provider.provideRenameEdits(
        doc,
        new vscode.Position(0, 5),
        'New Heading',
        new vscode.CancellationTokenSource().token
      );

      expect(edits).toBeDefined();

      // The heading text edit on fileA
      const fileAEdits = edits.get(toVsCodeUri(fileA.uri));
      expect(fileAEdits).toHaveLength(1);
      expect(fileAEdits[0].newText).toBe('New Heading');

      // The wikilink update edit on fileB
      const fileBEdits = edits.get(toVsCodeUri(fileB.uri));
      expect(fileBEdits).toHaveLength(1);
      expect(fileBEdits[0].newText).toContain('New Heading');
      expect(fileBEdits[0].newText).not.toContain('Old Heading');
    });

    it('should update self-referencing section links within the same file', async () => {
      const fileA = await createFile(
        '# Old Heading\n\nJump to [[#Old Heading]].\n'
      );

      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const foam = buildFoamLike(ws);
      const provider = new HeadingRenameProvider(foam as any);

      const { doc } = await showInEditor(fileA.uri);
      const edits = await provider.provideRenameEdits(
        doc,
        new vscode.Position(0, 5),
        'New Heading',
        new vscode.CancellationTokenSource().token
      );

      const fileAEdits = edits.get(toVsCodeUri(fileA.uri));
      // One edit for the heading text, one for the self-referencing link
      expect(fileAEdits).toHaveLength(2);
      const newTexts = fileAEdits.map(e => e.newText);
      expect(newTexts).toContain('New Heading');
      expect(newTexts.some(t => t.includes('[[#New Heading]]'))).toBe(true);
    });

    it('should not update links that reference a different section', async () => {
      const fileA = await createFile(
        '# Old Heading\n## Another Heading\n\nContent.\n'
      );
      const fileB = await createFile(
        `See [[${fileA.name}#Another Heading]] only.\n`
      );

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const foam = buildFoamLike(ws);
      const provider = new HeadingRenameProvider(foam as any);

      const { doc } = await showInEditor(fileA.uri);
      const edits = await provider.provideRenameEdits(
        doc,
        new vscode.Position(0, 5),
        'Renamed Heading',
        new vscode.CancellationTokenSource().token
      );

      // Only the heading text in fileA should be updated
      const fileAEdits = edits.get(toVsCodeUri(fileA.uri));
      expect(fileAEdits).toHaveLength(1);
      expect(fileAEdits[0].newText).toBe('Renamed Heading');

      // fileB's link points to "Another Heading", should not be changed
      const fileBEdits = edits.get(toVsCodeUri(fileB.uri));
      expect(fileBEdits ?? []).toHaveLength(0);
    });

    it('should update links using reference-style definitions', async () => {
      const refLinkContent = [
        '# Note B',
        '',
        'See [the reference][ref1] for more.',
        '',
        '[ref1]: <note-a#Old Heading>',
      ].join('\n');

      const fileA = await createFile('# Old Heading\n\nContent.\n', [
        'note-a.md',
      ]);
      const fileB = await createFile(refLinkContent);

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const foam = buildFoamLike(ws);
      const provider = new HeadingRenameProvider(foam as any);

      const { doc } = await showInEditor(fileA.uri);
      const edits = await provider.provideRenameEdits(
        doc,
        new vscode.Position(0, 5),
        'New Heading',
        new vscode.CancellationTokenSource().token
      );

      const fileBEdits = edits.get(toVsCodeUri(fileB.uri));
      expect(fileBEdits).toBeDefined();
      expect(fileBEdits).toHaveLength(1);
      // The edit should update the definition line, not the inline text
      expect(fileBEdits[0].newText).toContain('[ref1]: <note-a#New Heading>');
      expect(fileBEdits[0].newText).not.toContain('the reference');
    });
  });
});

import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { createNoteFromMarkdown, createTestNote, createTestWorkspace, InMemoryDataStore } from '../test/test-utils';
import { buildSite } from './index';

describe('publish buildSite', () => {
  it('rewrites note links to published routes and derives backlinks', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const noteAUri = root.joinPath('note-a.md');
    const noteBUri = root.joinPath('folder', 'note-b.md');
    const noteAContent = ['# Note A', '', 'See [[folder/note-b]].'].join('\n');
    const noteBContent = '# Note B';

    dataStore.set(noteAUri, noteAContent);
    dataStore.set(noteBUri, noteBContent);

    workspace
      .set(createNoteFromMarkdown('note-a.md', noteAContent, root))
      .set(createNoteFromMarkdown('folder/note-b.md', noteBContent, root));

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
    });

    expect(result.routes).toEqual(
      expect.arrayContaining([
        { sourceUri: noteAUri, route: '/note-a' },
        { sourceUri: noteBUri, route: '/folder/note-b' },
      ])
    );

    const publishedNoteA = result.notes.find(note => note.route === '/note-a');
    const publishedNoteB = result.notes.find(
      note => note.route === '/folder/note-b'
    );

    expect(publishedNoteA?.markdown).toContain('[Note B](/folder/note-b)');
    expect(publishedNoteB?.backlinks).toEqual([
      {
        route: '/note-a',
        title: 'Note A',
        sourceUri: noteAUri,
      },
    ]);
  });

  it('rewrites attachment links to asset output paths', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const noteUri = root.joinPath('note-a.md');
    const assetUri = root.joinPath('files', 'doc.pdf');
    const noteContent = ['# Note A', '', '[Manual](./files/doc.pdf)'].join('\n');

    dataStore.set(noteUri, noteContent);

    workspace
      .set(createNoteFromMarkdown('note-a.md', noteContent, root))
      .set(
        createTestNote({
          uri: '/files/doc.pdf',
          title: 'Manual',
          type: 'attachment',
        })
      );

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
    });

    expect(result.assets).toEqual([
      {
        sourceUri: assetUri,
        outputPath: 'assets/files/doc.pdf',
      },
    ]);
    const publishedNote = result.notes.find(note => note.route === '/note-a');
    expect(publishedNote?.markdown).toContain('[Manual](/assets/files/doc.pdf)');
  });
});

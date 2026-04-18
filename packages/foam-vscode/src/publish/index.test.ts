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

    expect(result.site).toEqual({
      title: undefined,
      description: undefined,
      homepageRoute: '/folder/note-b',
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

  it('supports programmable site metadata, homepage selection, and filtering', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('welcome.md');
    const hiddenUri = root.joinPath('draft.md');
    const guideUri = root.joinPath('guide.md');

    const homeContent = [
      '---',
      'title: Welcome',
      'description: Start here',
      'home: true',
      'publish: true',
      '---',
      '',
      '# Welcome',
    ].join('\n');
    const hiddenContent = [
      '---',
      'title: Draft',
      'publish: false',
      '---',
      '',
      '# Draft',
    ].join('\n');
    const guideContent = ['# Guide'].join('\n');

    dataStore.set(homeUri, homeContent);
    dataStore.set(hiddenUri, hiddenContent);
    dataStore.set(guideUri, guideContent);

    workspace
      .set(createNoteFromMarkdown('welcome.md', homeContent, root))
      .set(createNoteFromMarkdown('draft.md', hiddenContent, root))
      .set(createNoteFromMarkdown('guide.md', guideContent, root));

    const graph = FoamGraph.fromWorkspace(workspace);
    const result = await buildSite({
      workspace,
      graph,
      include: (resource, context) => {
        expect(context.workspace).toBe(workspace);
        expect(context.graph).toBe(graph);
        return resource.properties.publish !== false;
      },
      site: {
        title: ({ notes }) => `Published Notes (${notes.length})`,
        description: 'A programmable publish surface',
        homepage: note => note.properties.home === true,
      },
    });

    expect(result.site).toEqual({
      title: 'Published Notes (2)',
      description: 'A programmable publish surface',
      homepageRoute: '/welcome',
    });
    expect(result.routes).toEqual(
      expect.arrayContaining([
        { sourceUri: homeUri, route: '/welcome' },
        { sourceUri: guideUri, route: '/guide' },
      ])
    );
    expect(result.routes.find(route => route.sourceUri.path === hiddenUri.path)).toBeUndefined();

    const publishedHome = result.notes.find(note => note.route === '/welcome');
    expect(publishedHome).toMatchObject({
      title: 'Welcome',
      description: 'Start here',
      properties: {
        title: 'Welcome',
        description: 'Start here',
        home: true,
        publish: true,
      },
    });
    expect(result.notes.find(note => note.route === '/guide')?.properties).toEqual({});
    expect(result.notes.find(note => note.route === '/draft')).toBeUndefined();
  });
});

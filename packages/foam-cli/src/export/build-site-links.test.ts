import { FoamGraph } from '@foam/core';
import { URI } from '@foam/core';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
  InMemoryDataStore,
} from '../test/test-utils';
import { buildSite } from './index';

describe('export buildSite link handling', () => {
  it('rewrites note links to exported routes and derives backlinks', async () => {
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
    expect(result.diagnostics).toEqual([]);
    expect(result.routes).toEqual(
      expect.arrayContaining([
        { sourceUri: noteAUri, route: '/note-a' },
        { sourceUri: noteBUri, route: '/folder/note-b' },
      ])
    );

    const exportedNoteA = result.notes.find(note => note.route === '/note-a');
    const exportedNoteB = result.notes.find(
      note => note.route === '/folder/note-b'
    );

    expect(exportedNoteA?.markdown).toContain('[Note B](/folder/note-b)');
    expect(exportedNoteB?.backlinks).toEqual([
      {
        route: '/note-a',
        title: 'Note A',
        sourceUri: noteAUri,
      },
    ]);
  });

  it('deduplicates backlinks when the same source note links to a target multiple times', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const noteAUri = root.joinPath('note-a.md');
    const noteBUri = root.joinPath('note-b.md');
    const noteAContent = [
      '# Note A',
      '',
      'First reference to [[note-b]].',
      '',
      'Second reference to [[note-b]] again.',
    ].join('\n');
    const noteBContent = '# Note B';

    dataStore.set(noteAUri, noteAContent);
    dataStore.set(noteBUri, noteBContent);

    workspace
      .set(createNoteFromMarkdown('note-a.md', noteAContent, root))
      .set(createNoteFromMarkdown('note-b.md', noteBContent, root));

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
    });

    const exportedNoteB = result.notes.find(note => note.route === '/note-b');
    expect(exportedNoteB?.backlinks).toEqual([
      {
        route: '/note-a',
        title: 'Note A',
        sourceUri: noteAUri,
      },
    ]);
  });

  it('routes notes relative to contentRoot and reports links outside the exported scope', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('user', 'index.md');
    const guideUri = root.joinPath('user', 'guide.md');
    const internalUri = root.joinPath('dev', 'internal.md');

    const homeContent = [
      '# Home',
      '',
      'See [[guide]] and [Internal](../dev/internal.md).',
    ].join('\n');
    const guideContent = '# Guide';
    const internalContent = '# Internal';

    dataStore.set(homeUri, homeContent);
    dataStore.set(guideUri, guideContent);
    dataStore.set(internalUri, internalContent);

    workspace
      .set(createNoteFromMarkdown('user/index.md', homeContent, root))
      .set(createNoteFromMarkdown('user/guide.md', guideContent, root))
      .set(createNoteFromMarkdown('dev/internal.md', internalContent, root));

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
      contentRoot: 'user',
    });

    expect(result.site).toEqual({
      title: undefined,
      description: undefined,
      homepageRoute: '/',
    });
    expect(result.routes).toEqual(
      expect.arrayContaining([
        { sourceUri: homeUri, route: '/' },
        { sourceUri: guideUri, route: '/guide' },
      ])
    );
    expect(
      result.routes.find(route => route.sourceUri.path === internalUri.path)
    ).toBeUndefined();
    expect(
      result.notes.find(note => note.sourceUri.path === homeUri.path)?.markdown
    ).toContain('[Guide](/guide)');
    expect(
      result.notes.find(note => note.sourceUri.path === homeUri.path)?.markdown
    ).toContain('[Internal](../dev/internal.md)');
    expect(result.diagnostics).toEqual([
      {
        level: 'warning',
        code: 'unresolved-link',
        sourceUri: homeUri,
        sourceRoute: '/',
        link: '[Internal](../dev/internal.md)',
        target: internalUri.path,
        message:
          'Resolved [Internal](../dev/internal.md) but the target note is outside the exported content scope.',
      },
    ]);
  });
});

import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
  InMemoryDataStore,
} from '../../test/test-utils';
import { testExportTarget } from '../../test/test-export-target';
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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
      },
      testExportTarget()
    );

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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
      },
      testExportTarget()
    );

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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
        contentRoot: 'user',
      },
      testExportTarget()
    );

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

  it('preserves the caller-provided selection order in the artifact set', async () => {
    // Selector order is a load-bearing contract: the HTML-page target uses
    // BFS-ordered URIs and expects them to come out in the same order as
    // the section sequence in the rendered report.
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const aUri = root.joinPath('a.md');
    const bUri = root.joinPath('b.md');
    const cUri = root.joinPath('c.md');

    dataStore.set(aUri, '# A');
    dataStore.set(bUri, '# B');
    dataStore.set(cUri, '# C');

    workspace
      .set(createNoteFromMarkdown('a.md', '# A', root))
      .set(createNoteFromMarkdown('b.md', '# B', root))
      .set(createNoteFromMarkdown('c.md', '# C', root));

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
        select: () => [
          workspace.find(cUri)!,
          workspace.find(aUri)!,
          workspace.find(bUri)!,
        ],
      },
      testExportTarget()
    );

    expect(result.notes.map(n => n.title)).toEqual(['C', 'A', 'B']);
  });
});

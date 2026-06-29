import { FoamGraph } from '../../model/graph';
import { URI } from '../../model/uri';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
  InMemoryDataStore,
} from '../../../test/test-utils';
import { testExportTarget } from '../../../test/test-export-target';
import { buildSite } from '../index';

describe('export buildSite graph data', () => {
  it('derives graph data from exported routes only', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('user', 'index.md');
    const guideUri = root.joinPath('user', 'guide.md');
    const internalUri = root.joinPath('dev', 'internal.md');

    const homeContent = [
      '# Home',
      '',
      'Visit [[guide]] and [Internal](../dev/internal.md).',
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

    expect(result.graph.nodeInfo).toEqual({
      '/': {
        id: '/',
        type: 'note',
        title: 'Home',
        properties: {},
        tags: [],
      },
      '/guide': {
        id: '/guide',
        type: 'note',
        title: 'Guide',
        properties: {},
        tags: [],
      },
    });
    expect(result.graph.links).toEqual([
      {
        source: '/',
        target: '/guide',
      },
    ]);
  });
});

import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
  InMemoryDataStore,
} from '../test/test-utils';
import { buildSite } from './index';

describe('publish buildSite metadata and homepage selection', () => {
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
    expect(result.diagnostics).toEqual([]);
    expect(result.routes).toEqual(
      expect.arrayContaining([
        { sourceUri: homeUri, route: '/welcome' },
        { sourceUri: guideUri, route: '/guide' },
      ])
    );
    expect(
      result.routes.find(route => route.sourceUri.path === hiddenUri.path)
    ).toBeUndefined();

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
    expect(result.notes.find(note => note.route === '/guide')?.properties).toEqual(
      {}
    );
    expect(result.notes.find(note => note.route === '/draft')).toBeUndefined();
  });

  it('resolves homepage source paths relative to the workspace', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('user', 'index.md');
    const guideUri = root.joinPath('user', 'guide.md');
    const homeContent = '# Home';
    const guideContent = '# Guide';

    dataStore.set(homeUri, homeContent);
    dataStore.set(guideUri, guideContent);

    workspace
      .set(createNoteFromMarkdown('user/index.md', homeContent, root))
      .set(createNoteFromMarkdown('user/guide.md', guideContent, root));

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
      contentRoot: 'user',
      site: {
        homepage: 'user/guide.md',
      },
    });

    expect(result.site).toEqual({
      title: undefined,
      description: undefined,
      homepageRoute: '/guide',
    });
  });
});

import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { createNoteFromMarkdown, createTestNote, createTestWorkspace, InMemoryDataStore } from '../test/test-utils';
import { publishAssets } from './asset-filters';
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
    expect(result.diagnostics).toEqual([]);
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
    expect(result.diagnostics).toEqual([]);
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
    expect(result.diagnostics).toEqual([]);
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

  it('routes notes relative to contentRoot and reports links outside the published scope', async () => {
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
    expect(result.routes.find(route => route.sourceUri.path === internalUri.path)).toBeUndefined();
    expect(result.notes.find(note => note.sourceUri.path === homeUri.path)?.markdown).toContain(
      '[Guide](/guide)'
    );
    expect(result.notes.find(note => note.sourceUri.path === homeUri.path)?.markdown).toContain(
      '[Internal](../dev/internal.md)'
    );
    expect(result.diagnostics).toEqual([
      {
        level: 'warning',
        code: 'unresolved-link',
        sourceUri: homeUri,
        sourceRoute: '/',
        link: '[Internal](../dev/internal.md)',
        target: internalUri.path,
        message:
          'Resolved [Internal](../dev/internal.md) but the target note is outside the published content scope.',
      },
    ]);
  });

  it('publishes only linked assets while still allowing shared assets outside contentRoot', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('user', 'index.md');
    const linkedAssetUri = root.joinPath('assets', 'logo.png');
    const unrelatedAssetUri = root.joinPath('private', 'secret.pdf');
    const homeContent = ['# Home', '', '![Logo](../assets/logo.png)'].join('\n');

    dataStore.set(homeUri, homeContent);

    workspace
      .set(createNoteFromMarkdown('user/index.md', homeContent, root))
      .set(
        createTestNote({
          uri: '/assets/logo.png',
          title: 'logo.png',
          type: 'image',
        })
      )
      .set(
        createTestNote({
          uri: '/private/secret.pdf',
          title: 'secret.pdf',
          type: 'attachment',
        })
      );

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
      contentRoot: 'user',
    });

    expect(result.assets).toEqual([
      {
        sourceUri: linkedAssetUri,
        outputPath: 'assets/assets/logo.png',
      },
    ]);
    expect(result.assets.find(asset => asset.sourceUri.path === unrelatedAssetUri.path)).toBeUndefined();
    expect(result.notes[0].markdown).toContain('![Logo](/assets/assets/logo.png)');
  });

  it('supports a content-scoped linked-asset helper', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('user', 'index.md');
    const sharedAssetUri = root.joinPath('assets', 'logo.png');
    const contentAssetUri = root.joinPath('user', 'images', 'guide.png');
    const homeContent = [
      '# Home',
      '',
      '![Logo](../assets/logo.png)',
      '![Guide](./images/guide.png)',
    ].join('\n');

    dataStore.set(homeUri, homeContent);

    workspace
      .set(createNoteFromMarkdown('user/index.md', homeContent, root))
      .set(
        createTestNote({
          uri: '/assets/logo.png',
          title: 'logo.png',
          type: 'image',
        })
      )
      .set(
        createTestNote({
          uri: '/user/images/guide.png',
          title: 'guide.png',
          type: 'image',
        })
      );

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
      contentRoot: 'user',
      includeAsset: publishAssets.content(),
    });

    expect(result.assets).toEqual([
      {
        sourceUri: contentAssetUri,
        outputPath: 'assets/user/images/guide.png',
      },
    ]);
    expect(result.assets.find(asset => asset.sourceUri.path === sharedAssetUri.path)).toBeUndefined();
    expect(result.notes[0].markdown).toContain('![Logo](../assets/logo.png)');
    expect(result.notes[0].markdown).toContain(
      '![Guide](/assets/user/images/guide.png)'
    );
  });

  it('supports a programmable includeAsset matcher', async () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('user', 'index.md');
    const publicAssetUri = root.joinPath('assets', 'public.png');
    const privateAssetUri = root.joinPath('assets', 'private.png');
    const homeContent = [
      '# Home',
      '',
      '![Public](../assets/public.png)',
      '![Private](../assets/private.png)',
    ].join('\n');

    dataStore.set(homeUri, homeContent);

    workspace
      .set(createNoteFromMarkdown('user/index.md', homeContent, root))
      .set(
        createTestNote({
          uri: '/assets/public.png',
          title: 'public.png',
          type: 'image',
          properties: { visibility: 'public' },
        })
      )
      .set(
        createTestNote({
          uri: '/assets/private.png',
          title: 'private.png',
          type: 'image',
          properties: { visibility: 'private' },
        })
      );

    const result = await buildSite({
      workspace,
      graph: FoamGraph.fromWorkspace(workspace),
      contentRoot: 'user',
      includeAsset: (asset, context) => {
        expect(context.contentRoot?.path).toBe('/user');
        expect(context.publishedNotes.map(note => note.uri.path)).toEqual([
          homeUri.path,
        ]);
        expect(context.linkedFrom.map(note => note.uri.path)).toEqual([
          homeUri.path,
        ]);
        return asset.properties.visibility === 'public';
      },
    });

    expect(result.assets).toEqual([
      {
        sourceUri: publicAssetUri,
        outputPath: 'assets/assets/public.png',
      },
    ]);
    expect(result.assets.find(asset => asset.sourceUri.path === privateAssetUri.path)).toBeUndefined();
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

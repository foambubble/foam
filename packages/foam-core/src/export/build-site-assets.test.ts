import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import {
  createNoteFromMarkdown,
  createTestNote,
  createTestWorkspace,
  InMemoryDataStore,
} from '../../test/test-utils';
import { testExportTarget } from '../../test/test-export-target';
import { exportAssets } from './asset-filters';
import { buildSite } from './index';

describe('export buildSite asset handling', () => {
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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
      },
      testExportTarget()
    );

    expect(result.assets).toEqual([
      {
        sourceUri: assetUri,
        outputPath: 'assets/files/doc.pdf',
      },
    ]);
    expect(result.diagnostics).toEqual([]);

    const exportedNote = result.notes.find(note => note.route === '/note-a');
    expect(exportedNote?.markdown).toContain('[Manual](/assets/files/doc.pdf)');
  });

  it('exports only linked assets while still allowing shared assets outside contentRoot', async () => {
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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
        contentRoot: 'user',
      },
      testExportTarget()
    );

    expect(result.assets).toEqual([
      {
        sourceUri: linkedAssetUri,
        outputPath: 'assets/assets/logo.png',
      },
    ]);
    expect(
      result.assets.find(asset => asset.sourceUri.path === unrelatedAssetUri.path)
    ).toBeUndefined();
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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
        contentRoot: 'user',
        includeAsset: exportAssets.content(),
      },
      testExportTarget()
    );

    expect(result.assets).toEqual([
      {
        sourceUri: contentAssetUri,
        outputPath: 'assets/user/images/guide.png',
      },
    ]);
    expect(
      result.assets.find(asset => asset.sourceUri.path === sharedAssetUri.path)
    ).toBeUndefined();
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

    const result = await buildSite(
      {
        workspace,
        graph: FoamGraph.fromWorkspace(workspace),
        contentRoot: 'user',
        includeAsset: (asset, context) => {
          expect(context.contentRoot?.path).toBe('/user');
          expect(context.exportedNotes.map(note => note.uri.path)).toEqual([
            homeUri.path,
          ]);
          expect(context.linkedFrom.map(note => note.uri.path)).toEqual([
            homeUri.path,
          ]);
          return asset.properties.visibility === 'public';
        },
      },
      testExportTarget()
    );

    expect(result.assets).toEqual([
      {
        sourceUri: publicAssetUri,
        outputPath: 'assets/assets/public.png',
      },
    ]);
    expect(
      result.assets.find(asset => asset.sourceUri.path === privateAssetUri.path)
    ).toBeUndefined();
  });
});

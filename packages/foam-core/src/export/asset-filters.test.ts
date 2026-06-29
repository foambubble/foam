import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { exportAssets } from './asset-filters';
import { getIncludeAssetMatcher } from './config';

describe('export asset filters', () => {
  it('defaults to including linked assets from the workspace', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const graph = FoamGraph.fromWorkspace(workspace);
    const asset = createTestNote({
      uri: '/assets/logo.png',
      title: 'logo.png',
      type: 'image',
    });

    expect(
      getIncludeAssetMatcher({ workspace })(asset, {
        workspace,
        graph,
        contentRoot: URI.file('/user'),
        exportedNotes: [],
        linkedFrom: [],
      })
    ).toBe(true);
  });

  it('content helper treats missing contentRoot as unrestricted', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const graph = FoamGraph.fromWorkspace(workspace);
    const asset = createTestNote({
      uri: '/assets/logo.png',
      title: 'logo.png',
      type: 'image',
    });

    expect(
      exportAssets.content()(asset, {
        workspace,
        graph,
        contentRoot: null,
        exportedNotes: [],
        linkedFrom: [],
      })
    ).toBe(true);
  });

  it('content helper only includes assets under contentRoot', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const graph = FoamGraph.fromWorkspace(workspace);
    const includedAsset = createTestNote({
      uri: '/user/images/guide.png',
      title: 'guide.png',
      type: 'image',
    });
    const excludedAsset = createTestNote({
      uri: '/assets/logo.png',
      title: 'logo.png',
      type: 'image',
    });

    const matcher = exportAssets.content();

    expect(
      matcher(includedAsset, {
        workspace,
        graph,
        contentRoot: URI.file('/user'),
        exportedNotes: [],
        linkedFrom: [],
      })
    ).toBe(true);
    expect(
      matcher(excludedAsset, {
        workspace,
        graph,
        contentRoot: URI.file('/user'),
        exportedNotes: [],
        linkedFrom: [],
      })
    ).toBe(false);
  });
});

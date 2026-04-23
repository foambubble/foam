import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { createTestNote, createTestWorkspace } from '../test/test-utils';
import { buildGraphData } from './graph-data-builder';

const root = URI.file('/');
const pathId = (uri: URI) => uri.path;

describe('buildGraphData', () => {
  it('builds nodes for all provided resources', () => {
    const note = createTestNote({ uri: '/note-a.md', title: 'Note A', root });
    const result = buildGraphData([note], [], { resourceToId: pathId });
    expect(result.nodeInfo[note.uri.path]).toEqual({
      id: note.uri.path,
      type: 'note',
      title: 'Note A',
      properties: {},
      tags: [],
    });
  });

  it('strips tag range from output', () => {
    const note = createTestNote({ uri: '/tagged.md', tags: ['foo'], root });
    const result = buildGraphData([note], [], { resourceToId: pathId });
    expect(result.nodeInfo[note.uri.path].tags).toEqual([{ label: 'foo' }]);
  });

  it('excludes resources when resourceToId returns undefined', () => {
    const included = createTestNote({ uri: '/included.md', root });
    const excluded = createTestNote({ uri: '/excluded.md', root });
    const result = buildGraphData([included, excluded], [], {
      resourceToId: uri => (uri.path.includes('excluded') ? undefined : uri.path),
    });
    expect(Object.keys(result.nodeInfo)).toEqual([included.uri.path]);
  });

  it('applies transformTitle when provided', () => {
    const note = createTestNote({ uri: '/long-title.md', title: 'A Very Long Title', root });
    const result = buildGraphData([note], [], {
      resourceToId: pathId,
      transformTitle: title => title.substring(0, 5) + '...',
    });
    expect(result.nodeInfo[note.uri.path].title).toBe('A Ver...');
  });

  it('uses getBasename for non-note resources', () => {
    const img = createTestNote({ uri: '/image.png', type: 'image', root });
    const result = buildGraphData([img], [], { resourceToId: pathId });
    expect(result.nodeInfo[img.uri.path].title).toBe('image.png');
  });

  it('uses properties.type for notes with custom type', () => {
    const note = createTestNote({
      uri: '/blog-post.md',
      type: 'note',
      properties: { type: 'blog' },
      root,
    });
    const result = buildGraphData([note], [], { resourceToId: pathId });
    expect(result.nodeInfo[note.uri.path].type).toBe('blog');
  });

  it('builds links from connections', () => {
    const workspace = createTestWorkspace();
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }], root });
    const b = createTestNote({ uri: '/b.md', root });
    workspace.set(a).set(b);
    const graph = FoamGraph.fromWorkspace(workspace);

    const result = buildGraphData([a, b], graph.getAllConnections(), {
      resourceToId: pathId,
    });

    expect(result.links).toContainEqual({ source: a.uri.path, target: b.uri.path });
  });

  it('deduplicates links', () => {
    const workspace = createTestWorkspace();
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }, { slug: 'b' }], root });
    const b = createTestNote({ uri: '/b.md', root });
    workspace.set(a).set(b);
    const graph = FoamGraph.fromWorkspace(workspace);

    const result = buildGraphData([a, b], graph.getAllConnections(), {
      resourceToId: pathId,
    });

    const aToB = result.links.filter(
      l => l.source === a.uri.path && l.target === b.uri.path
    );
    expect(aToB).toHaveLength(1);
  });

  it('excludes connections where resourceToId returns undefined for source', () => {
    const workspace = createTestWorkspace();
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }], root });
    const b = createTestNote({ uri: '/b.md', root });
    workspace.set(a).set(b);
    const graph = FoamGraph.fromWorkspace(workspace);

    // resourceToId only maps b, not a — so the a→b connection has no source id
    const result = buildGraphData([a, b], graph.getAllConnections(), {
      resourceToId: uri => (uri.path === b.uri.path ? uri.path : undefined),
    });

    expect(result.links).toHaveLength(0);
  });

  it('excludes placeholder connections when includePlaceholders is false', () => {
    const workspace = createTestWorkspace();
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'missing' }], root });
    workspace.set(a);
    const graph = FoamGraph.fromWorkspace(workspace);

    const result = buildGraphData([a], graph.getAllConnections(), {
      resourceToId: pathId,
      includePlaceholders: false,
    });

    expect(result.links).toHaveLength(0);
  });

  it('includes placeholder connections and nodes when includePlaceholders is true', () => {
    const workspace = createTestWorkspace();
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'missing' }], root });
    workspace.set(a);
    const graph = FoamGraph.fromWorkspace(workspace);

    const result = buildGraphData([a], graph.getAllConnections(), {
      resourceToId: pathId,
      includePlaceholders: true,
    });

    expect(result.links).toHaveLength(1);
    const placeholderId = result.links[0].target;
    expect(result.nodeInfo[placeholderId].type).toBe('placeholder');
  });

  it('creates placeholder node via fallback path when resourceToId returns undefined for placeholder', () => {
    // Simulates the route-map case: only mapped resources have IDs
    const workspace = createTestWorkspace();
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'missing' }], root });
    workspace.set(a);
    const graph = FoamGraph.fromWorkspace(workspace);
    const knownIds = new Map([[a.uri.path, '/a']]);

    const result = buildGraphData([a], graph.getAllConnections(), {
      resourceToId: uri => knownIds.get(uri.path),
      includePlaceholders: true,
    });

    expect(result.links).toHaveLength(1);
    expect(result.links[0].source).toBe('/a');
    const placeholderId = result.links[0].target;
    expect(result.nodeInfo[placeholderId].type).toBe('placeholder');
  });

  it('maps node IDs through resourceToId (route mapping)', () => {
    const routeMap = new Map([
      ['/user/index.md', '/'],
      ['/user/guide.md', '/guide'],
    ]);
    const index = createTestNote({ uri: '/user/index.md', links: [{ to: '/user/guide.md' }], root });
    const guide = createTestNote({ uri: '/user/guide.md', root });
    const workspace = createTestWorkspace();
    workspace.set(index).set(guide);
    const graph = FoamGraph.fromWorkspace(workspace);

    const result = buildGraphData([index, guide], graph.getAllConnections(), {
      resourceToId: uri => routeMap.get(uri.path),
    });

    expect(result.nodeInfo['/']).toBeDefined();
    expect(result.nodeInfo['/guide']).toBeDefined();
    expect(result.links).toContainEqual({ source: '/', target: '/guide' });
  });
});

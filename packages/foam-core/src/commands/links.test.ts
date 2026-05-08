import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamGraph } from '../model/graph';
import { traverseGraph } from './links';

const buildGraph = () => {
  const workspace = createTestWorkspace();
  // a → b, a → c, b → d, c → d, d → e
  workspace
    .set(createTestNote({ uri: '/a.md', links: [{ slug: 'b' }, { slug: 'c' }] }))
    .set(createTestNote({ uri: '/b.md', links: [{ slug: 'd' }] }))
    .set(createTestNote({ uri: '/c.md', links: [{ slug: 'd' }] }))
    .set(createTestNote({ uri: '/d.md', links: [{ slug: 'e' }] }))
    .set(createTestNote({ uri: '/e.md' }));
  return { workspace, graph: FoamGraph.fromWorkspace(workspace) };
};

describe('traverseGraph', () => {
  it('returns just the start node when depth is 0', () => {
    const { workspace, graph } = buildGraph();
    const a = workspace.find('a')!.uri;
    const result = traverseGraph(workspace, graph, a, 0, 'links');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].uri.path).toBe(a.path);
    expect(result.nodes[0].distance).toBe(0);
    expect(result.edges).toEqual([]);
  });

  it('walks outgoing links to the requested depth', () => {
    const { workspace, graph } = buildGraph();
    const a = workspace.find('a')!.uri;
    const result = traverseGraph(workspace, graph, a, 1, 'links');
    const paths = result.nodes.map(n => n.uri.path).sort();
    expect(paths).toEqual(['/a.md', '/b.md', '/c.md']);
    expect(result.nodes.find(n => n.uri.path === '/a.md')!.distance).toBe(0);
    expect(result.nodes.find(n => n.uri.path === '/b.md')!.distance).toBe(1);
  });

  it('walks backlinks when direction is backlinks', () => {
    const { workspace, graph } = buildGraph();
    const d = workspace.find('d')!.uri;
    const result = traverseGraph(workspace, graph, d, 1, 'backlinks');
    const paths = result.nodes.map(n => n.uri.path).sort();
    expect(paths).toEqual(['/b.md', '/c.md', '/d.md']);
  });

  it('reports the shortest distance when multiple paths reach a node', () => {
    const { workspace, graph } = buildGraph();
    const a = workspace.find('a')!.uri;
    // a → b → d AND a → c → d both reach d in 2 hops
    const result = traverseGraph(workspace, graph, a, 3, 'links');
    expect(result.nodes.find(n => n.uri.path === '/d.md')!.distance).toBe(2);
    expect(result.nodes.find(n => n.uri.path === '/e.md')!.distance).toBe(3);
  });

  it('does not duplicate edges across traversal layers', () => {
    const { workspace, graph } = buildGraph();
    const a = workspace.find('a')!.uri;
    const result = traverseGraph(workspace, graph, a, 5, 'both');
    const edgeKeys = result.edges.map(e => `${e.source.path}->${e.target.path}`);
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });

  it('handles missing target as placeholder', () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({ uri: '/lonely.md', links: [{ slug: 'missing' }] })
    );
    const graph = FoamGraph.fromWorkspace(workspace);
    const lonely = workspace.find('lonely')!.uri;
    const result = traverseGraph(workspace, graph, lonely, 1, 'links');
    const placeholder = result.nodes.find(n => n.type === 'placeholder');
    expect(placeholder).toBeDefined();
  });
});

import { withMcpServer } from '../test-setup';

const SEED = {
  'a.md': '# A\n\nLinks to [[b]] and [[c]].',
  'b.md': '# B\n\nLinks to [[d]].',
  'c.md': '# C\n\nLinks to [[d]].',
  'd.md': '# D\n\nLinks to [[missing]].',
  'e.md': '# E\n\nIsolated note.',
};

describe('graph tools', () => {
  it('get_connections returns outgoing and incoming links', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{
        links: Array<{ uri: string }>;
        backlinks: Array<{ uri: string }>;
      }>('get_connections', { uri: 'a.md' });
      expect(result.links.map(l => l.uri).sort()).toEqual(['b.md', 'c.md']);
      expect(result.backlinks).toEqual([]);
    }));

  it('get_connections respects direction=links', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{
        links: Array<unknown>;
        backlinks: Array<unknown>;
      }>('get_connections', { uri: 'd.md', direction: 'links' });
      expect(result.backlinks).toEqual([]);
      expect(result.links.length).toBeGreaterThan(0);
    }));

  it('get_orphans returns notes with no connections', () =>
    withMcpServer(SEED, async ctx => {
      const orphans = await ctx.callToolJson<Array<{ uri: string }>>(
        'get_orphans'
      );
      expect(orphans.map(o => o.uri)).toEqual(['e.md']);
    }));

  it('get_placeholders returns broken wikilink targets', () =>
    withMcpServer(SEED, async ctx => {
      const placeholders = await ctx.callToolJson<
        Array<{
          placeholder_id: string;
          referenced_by: Array<{ uri: string }>;
        }>
      >('get_placeholders');
      const missing = placeholders.find(p => p.placeholder_id === 'missing');
      expect(missing).toBeDefined();
      expect(missing!.referenced_by.map(r => r.uri)).toEqual(['d.md']);
    }));

  it('traverse_graph performs BFS up to the requested depth', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{
        nodes: Array<{ uri: string; distance: number }>;
        edges: Array<{ source: string; target: string }>;
      }>('traverse_graph', { uri: 'a.md', depth: 2, direction: 'links' });
      const distances = Object.fromEntries(
        result.nodes.map(n => [n.uri, n.distance])
      );
      expect(distances['a.md']).toBe(0);
      expect(distances['b.md']).toBe(1);
      expect(distances['c.md']).toBe(1);
      expect(distances['d.md']).toBe(2);
    }));

  it('get_workspace_info returns counts', () =>
    withMcpServer(SEED, async ctx => {
      const info = await ctx.callToolJson<{
        note_count: number;
        connection_count: number;
        placeholder_count: number;
      }>('get_workspace_info');
      expect(info.note_count).toBe(5);
      expect(info.placeholder_count).toBe(1);
      expect(info.connection_count).toBeGreaterThan(0);
    }));
});

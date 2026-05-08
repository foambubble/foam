import { buildTestHarness } from '../test-setup';

const SEED = {
  'a.md': '# A\n\nLinks to [[b]] and [[c]].',
  'b.md': '# B\n\nLinks to [[d]].',
  'c.md': '# C\n\nLinks to [[d]].',
  'd.md': '# D\n\nLinks to [[missing]].',
  'e.md': '# E\n\nIsolated note.',
};

describe('graph tools', () => {
  it('get_connections returns outgoing and incoming links', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{
        links: Array<{ uri: string }>;
        backlinks: Array<{ uri: string }>;
      }>('get_connections', { uri: 'a.md' });
      expect(result.links.map(l => l.uri).sort()).toEqual(['b.md', 'c.md']);
      expect(result.backlinks).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('get_connections respects direction=links', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{
        links: Array<unknown>;
        backlinks: Array<unknown>;
      }>('get_connections', { uri: 'd.md', direction: 'links' });
      expect(result.backlinks).toEqual([]);
      expect(result.links.length).toBeGreaterThan(0);
    } finally {
      await h.close();
    }
  });

  it('get_orphans returns notes with no connections', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const orphans = await h.callToolJson<Array<{ uri: string }>>(
        'get_orphans'
      );
      expect(orphans.map(o => o.uri)).toEqual(['e.md']);
    } finally {
      await h.close();
    }
  });

  it('get_placeholders returns broken wikilink targets', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const placeholders = await h.callToolJson<
        Array<{ placeholder_id: string; referenced_by: Array<{ uri: string }> }>
      >('get_placeholders');
      const missing = placeholders.find(p => p.placeholder_id === 'missing');
      expect(missing).toBeDefined();
      expect(missing!.referenced_by.map(r => r.uri)).toEqual(['d.md']);
    } finally {
      await h.close();
    }
  });

  it('traverse_graph performs BFS up to the requested depth', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{
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
    } finally {
      await h.close();
    }
  });

  it('get_workspace_info returns counts', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const info = await h.callToolJson<{
        note_count: number;
        connection_count: number;
        placeholder_count: number;
      }>('get_workspace_info');
      expect(info.note_count).toBe(5);
      expect(info.placeholder_count).toBe(1);
      expect(info.connection_count).toBeGreaterThan(0);
    } finally {
      await h.close();
    }
  });
});

import { FoamGraph } from '@foam/core';
import {
  createTestNote,
  createTestWorkspace,
} from '../../../test/test-utils';
import { collectNoteSet } from './note-set';

function makeWorkspace(...notes: ReturnType<typeof createTestNote>[]) {
  const ws = createTestWorkspace();
  for (const note of notes) {
    ws.set(note);
  }
  const graph = FoamGraph.fromWorkspace(ws);
  return { ws, graph };
}

describe('collectNoteSet', () => {
  it('includes only the entry point at depth 0', () => {
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const b = createTestNote({ uri: '/b.md' });
    const { ws, graph } = makeWorkspace(a, b);
    expect(collectNoteSet(ws, graph, a.uri, 0)).toEqual([a.uri]);
  });

  it('follows outgoing links breadth-first', () => {
    const a = createTestNote({
      uri: '/a.md',
      links: [{ slug: 'b' }, { slug: 'c' }],
    });
    const b = createTestNote({ uri: '/b.md', links: [{ slug: 'd' }] });
    const c = createTestNote({ uri: '/c.md', links: [{ slug: 'e' }] });
    const d = createTestNote({ uri: '/d.md' });
    const e = createTestNote({ uri: '/e.md' });
    const { ws, graph } = makeWorkspace(a, b, c, d, e);
    const result = collectNoteSet(ws, graph, a.uri, 2);
    expect(result.map(u => u.path)).toEqual([
      '/a.md',
      '/b.md',
      '/c.md',
      '/d.md',
      '/e.md',
    ]);
  });

  it('respects the depth limit', () => {
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const b = createTestNote({ uri: '/b.md', links: [{ slug: 'c' }] });
    const c = createTestNote({ uri: '/c.md', links: [{ slug: 'd' }] });
    const d = createTestNote({ uri: '/d.md' });
    const { ws, graph } = makeWorkspace(a, b, c, d);
    expect(collectNoteSet(ws, graph, a.uri, 1).map(u => u.path)).toEqual([
      '/a.md',
      '/b.md',
    ]);
    expect(collectNoteSet(ws, graph, a.uri, 2).map(u => u.path)).toEqual([
      '/a.md',
      '/b.md',
      '/c.md',
    ]);
  });

  it('preserves source link order within a BFS level', () => {
    const a = createTestNote({
      uri: '/a.md',
      links: [{ slug: 'c' }, { slug: 'b' }],
    });
    const b = createTestNote({ uri: '/b.md' });
    const c = createTestNote({ uri: '/c.md' });
    const { ws, graph } = makeWorkspace(a, b, c);
    expect(collectNoteSet(ws, graph, a.uri, 1).map(u => u.path)).toEqual([
      '/a.md',
      '/c.md',
      '/b.md',
    ]);
  });

  it('handles cycles without duplicating nodes', () => {
    const a = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const b = createTestNote({ uri: '/b.md', links: [{ slug: 'a' }] });
    const { ws, graph } = makeWorkspace(a, b);
    expect(collectNoteSet(ws, graph, a.uri, 5).map(u => u.path)).toEqual([
      '/a.md',
      '/b.md',
    ]);
  });

  it('skips placeholder links', () => {
    const a = createTestNote({
      uri: '/a.md',
      links: [{ slug: 'ghost' }, { slug: 'b' }],
    });
    const b = createTestNote({ uri: '/b.md' });
    const { ws, graph } = makeWorkspace(a, b);
    expect(collectNoteSet(ws, graph, a.uri, 1).map(u => u.path)).toEqual([
      '/a.md',
      '/b.md',
    ]);
  });

  it('returns an empty array when the entry point does not exist', () => {
    const a = createTestNote({ uri: '/a.md' });
    const { ws, graph } = makeWorkspace(a);
    const missing = createTestNote({ uri: '/missing.md' });
    expect(collectNoteSet(ws, graph, missing.uri, 3)).toEqual([]);
  });
});

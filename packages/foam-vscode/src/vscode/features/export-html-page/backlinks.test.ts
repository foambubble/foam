import { FoamGraph } from '@foam/core';
import {
  createTestNote,
  createTestWorkspace,
} from '../../../test/test-utils';
import { collectInReportBacklinks } from './backlinks';

function makeWorkspace(...notes: ReturnType<typeof createTestNote>[]) {
  const ws = createTestWorkspace();
  for (const note of notes) {
    ws.set(note);
  }
  return { ws, graph: FoamGraph.fromWorkspace(ws) };
}

describe('collectInReportBacklinks', () => {
  it('returns backlinks from sources that are in the report set', () => {
    const a = createTestNote({
      uri: '/a.md',
      title: 'A',
      links: [{ slug: 'c' }],
    });
    const b = createTestNote({
      uri: '/b.md',
      title: 'B',
      links: [{ slug: 'c' }],
    });
    const c = createTestNote({ uri: '/c.md', title: 'C' });
    const { ws, graph } = makeWorkspace(a, b, c);
    const entries = collectInReportBacklinks(ws, graph, c.uri, [
      a.uri,
      b.uri,
      c.uri,
    ]);
    expect(entries.map(e => e.sourceTitle)).toEqual(['A', 'B']);
  });

  it('excludes backlinks from sources outside the report set', () => {
    const a = createTestNote({
      uri: '/a.md',
      title: 'A',
      links: [{ slug: 'c' }],
    });
    const b = createTestNote({
      uri: '/b.md',
      title: 'B',
      links: [{ slug: 'c' }],
    });
    const c = createTestNote({ uri: '/c.md', title: 'C' });
    const { ws, graph } = makeWorkspace(a, b, c);
    const entries = collectInReportBacklinks(ws, graph, c.uri, [a.uri, c.uri]);
    expect(entries.map(e => e.sourceTitle)).toEqual(['A']);
  });

  it('deduplicates multiple links from the same source', () => {
    const a = createTestNote({
      uri: '/a.md',
      title: 'A',
      links: [{ slug: 'c' }, { slug: 'c' }],
    });
    const c = createTestNote({ uri: '/c.md', title: 'C' });
    const { ws, graph } = makeWorkspace(a, c);
    const entries = collectInReportBacklinks(ws, graph, c.uri, [a.uri, c.uri]);
    expect(entries).toHaveLength(1);
    expect(entries[0].sourceTitle).toBe('A');
  });
});

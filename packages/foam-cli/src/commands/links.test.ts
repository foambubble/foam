import { FoamGraph, FoamWorkspace, URI } from '@foam/core';
import { createTestNote, createTestWorkspace, createTmpWorkspace, TestLogger } from '../test/test-utils';
import { linksData, runLinksCommand } from './links';

const ROOT = URI.file('/workspace');

function makeWorkspace(
  notes: ReturnType<typeof createTestNote>[]
): FoamWorkspace {
  const ws = createTestWorkspace([ROOT]);
  for (const note of notes) ws.set(note);
  return ws;
}

// ─── linksData ────────────────────────────────────────────────────────────────

describe('linksData', () => {
  it('returns outgoing and incoming connections', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'b' }], root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', root: ROOT }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);

    const dataA = linksData(ws, graph, 'a', undefined, '/workspace');
    expect(dataA.outgoing.map(c => c.id)).toContain('b');
    expect(dataA.incoming).toHaveLength(0);

    const dataB = linksData(ws, graph, 'b', undefined, '/workspace');
    expect(dataB.outgoing).toHaveLength(0);
    expect(dataB.incoming.map(c => c.id)).toContain('a');
  });

  it('includes placeholder targets in outgoing', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'missing' }], root: ROOT }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const data = linksData(ws, graph, 'a', undefined, '/workspace');
    expect(data.outgoing).toHaveLength(1);
    expect(data.outgoing[0].id).toContain('missing');
  });
});

// ─── runLinksCommand ──────────────────────────────────────────────────────────

describe('runLinksCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runLinksCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam links');
  });

  it('shows help when no args given', async () => {
    const logger = new TestLogger();
    const code = await runLinksCommand([], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam links');
  });

  it('errors when flags given but no identifier or --path', async () => {
    const logger = new TestLogger();
    // --outgoing is a boolean flag, so first will be '--outgoing', treated as flag → no identifier
    const code = await runLinksCommand(['--outgoing'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('identifier');
  });

  it('shows both directions by default as text', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n\n[[b]]', 'b.md': '# B' });
    try {
      const logger = new TestLogger();
      const code = await runLinksCommand(['a', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('Outgoing');
      expect(out).toContain('Incoming');
    } finally {
      cleanup();
    }
  });

  it('shows only outgoing with --outgoing', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n\n[[b]]', 'b.md': '# B' });
    try {
      const logger = new TestLogger();
      const code = await runLinksCommand(['a', '--outgoing', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('Outgoing');
      expect(out).not.toContain('Incoming');
    } finally {
      cleanup();
    }
  });

  it('returns JSON with id, outgoing, incoming', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n\n[[b]]', 'b.md': '# B' });
    try {
      const logger = new TestLogger();
      const code = await runLinksCommand(['a', '--format', 'json', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'a');
      expect(Array.isArray(result.outgoing)).toBe(true);
      expect(Array.isArray(result.incoming)).toBe(true);
    } finally {
      cleanup();
    }
  });
});

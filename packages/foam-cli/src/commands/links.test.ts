import { FoamGraph } from '@foam/core';
import { createTestNote, createInMemoryWorkspace, withTmpWorkspace, TestLogger } from '../test/test-utils';
import { linksData, runLinksCommand } from './links';

// ─── linksData ────────────────────────────────────────────────────────────────

describe('linksData', () => {
  it('returns outgoing and incoming connections', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'b' }] }),
      createTestNote({ uri: '/workspace/b.md' }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);

    const dataA = linksData(ws, graph, 'a', undefined, root.toFsPath());
    expect(dataA.outgoing.map(c => c.id)).toContain('b');
    expect(dataA.incoming).toHaveLength(0);

    const dataB = linksData(ws, graph, 'b', undefined, root.toFsPath());
    expect(dataB.outgoing).toHaveLength(0);
    expect(dataB.incoming.map(c => c.id)).toContain('a');
  });

  it('includes placeholder targets in outgoing', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'missing' }] }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const data = linksData(ws, graph, 'a', undefined, root.toFsPath());
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

  it('shows both directions by default as text', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n[[b]]', 'b.md': '# B' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runLinksCommand(['a', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('Outgoing');
      expect(out).toContain('Incoming');
    }));

  it('shows only outgoing with --outgoing', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n[[b]]', 'b.md': '# B' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runLinksCommand(['a', '--outgoing', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('Outgoing');
      expect(out).not.toContain('Incoming');
    }));

  it('returns JSON with id, outgoing, incoming', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n[[b]]', 'b.md': '# B' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runLinksCommand(['a', '--format', 'json', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'a');
      expect(Array.isArray(result.outgoing)).toBe(true);
      expect(Array.isArray(result.incoming)).toBe(true);
    }));
});

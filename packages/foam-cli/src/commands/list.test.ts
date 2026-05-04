import path from 'node:path';
import { FoamGraph, FoamTags } from '@foam/core';
import {
  createTestNote,
  createInMemoryWorkspace,
  withTmpWorkspace,
  TestLogger,
} from '../test/test-utils';
import {
  listNotes,
  listTags,
  listOrphans,
  listDeadends,
  listPlaceholders,
  listTemplates,
  runListCommand,
} from './list';

// ─── listNotes ────────────────────────────────────────────────────────────────

describe('listNotes', () => {
  it('returns all notes with id, path, title, type, tags', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', title: 'A' }),
      createTestNote({ uri: '/workspace/b.md', title: 'B' }),
    ]);
    const result = listNotes(ws, root.toFsPath(), {});
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'a')).toMatchObject({ title: 'A', type: 'note' });
    expect(result.find(r => r.id === 'b')).toMatchObject({ title: 'B', type: 'note' });
  });

  it('filters by type', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', title: 'A', type: 'note' }),
      createTestNote({ uri: '/workspace/b.md', title: 'B', type: 'daily-note' }),
    ]);
    const result = listNotes(ws, root.toFsPath(), { type: 'daily-note' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('filters by tag (AND for multiple tags)', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['work', 'project'] }),
      createTestNote({ uri: '/workspace/b.md', tags: ['work'] }),
    ]);
    const result = listNotes(ws, root.toFsPath(), { tags: ['work', 'project'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('limits results', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md' }),
      createTestNote({ uri: '/workspace/b.md' }),
      createTestNote({ uri: '/workspace/c.md' }),
    ]);
    const result = listNotes(ws, root.toFsPath(), { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('includes relative path from workspace root', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/notes/a.md', title: 'A' }),
    ]);
    const result = listNotes(ws, root.toFsPath(), {});
    expect(result[0].path).toBe(path.join('notes', 'a.md'));
  });
});

// ─── listTags ─────────────────────────────────────────────────────────────────

describe('listTags', () => {
  it('returns tag name and count', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['foo', 'bar'] }),
      createTestNote({ uri: '/workspace/b.md', tags: ['foo'] }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, {});
    expect(result.find(t => t.tag === 'foo')?.count).toBe(2);
    expect(result.find(t => t.tag === 'bar')?.count).toBe(1);
  });

  it('filters by prefix', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['work/project', 'personal'] }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, { prefix: 'work' });
    expect(result.map(t => t.tag)).toEqual(['work/project']);
  });

  it('sorts by count descending when sort=count', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['foo', 'bar'] }),
      createTestNote({ uri: '/workspace/b.md', tags: ['foo'] }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, { sort: 'count' });
    expect(result[0].tag).toBe('foo');
  });

  it('sorts by name ascending by default', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['zzz', 'aaa'] }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, {});
    expect(result[0].tag).toBe('aaa');
    expect(result[1].tag).toBe('zzz');
  });
});

// ─── listOrphans ──────────────────────────────────────────────────────────────

describe('listOrphans', () => {
  it('returns notes with no incoming and no outgoing links', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/linked.md', links: [{ slug: 'target' }] }),
      createTestNote({ uri: '/workspace/target.md' }),
      createTestNote({ uri: '/workspace/orphan.md' }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const result = listOrphans(ws, graph, root.toFsPath());
    // orphan has no connections; linked has outgoing; target has incoming
    const ids = result.map(r => r.id);
    expect(ids).toContain('orphan');
    expect(ids).not.toContain('linked');
    expect(ids).not.toContain('target');
  });
});

// ─── listDeadends ─────────────────────────────────────────────────────────────

describe('listDeadends', () => {
  it('returns notes with no outgoing links', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/linked.md', links: [{ slug: 'target' }] }),
      createTestNote({ uri: '/workspace/target.md' }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const result = listDeadends(ws, graph, root.toFsPath());
    const ids = result.map(r => r.id);
    expect(ids).toContain('target');
    expect(ids).not.toContain('linked');
  });
});

// ─── listPlaceholders ────────────────────────────────────────────────────────

describe('listPlaceholders', () => {
  it('returns placeholder ids with referencing notes', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'missing-note' }] }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const result = listPlaceholders(ws, graph, root.toFsPath());
    expect(result).toHaveLength(1);
    expect(result[0].placeholder_id).toBe('missing-note');
    expect(result[0].referenced_by.map(r => r.id)).toContain('a');
  });
});

// ─── listTemplates ────────────────────────────────────────────────────────────

describe('listTemplates', () => {
  it('returns empty array when templates dir does not exist', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const result = await listTemplates(rootDir);
      expect(result).toEqual([]);
    }));

  it('returns templates from .foam/templates with description from frontmatter', () =>
    withTmpWorkspace(
      {
        '.foam/templates/meeting.md': [
          '---',
          'foam_template:',
          '  description: Template for meeting notes',
          '---',
          '',
          '# Meeting',
        ].join('\n'),
        '.foam/templates/default.md': '# Default',
      },
      async ({ rootDir }) => {
        const result = await listTemplates(rootDir);
        const names = result.map(t => t.name);
        expect(names).toContain('meeting');
        expect(names).toContain('default');
        const meeting = result.find(t => t.name === 'meeting')!;
        expect(meeting.description).toBe('Template for meeting notes');
      }
    ));
});

// ─── runListCommand (integration) ────────────────────────────────────────────

describe('runListCommand', () => {
  it('returns exit 0 and prints help when given --help', async () => {
    const logger = new TestLogger();
    const code = await runListCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam list');
    expect(logger.errors).toHaveLength(0);
  });

  it('returns exit 1 for unknown subcommand', async () => {
    const logger = new TestLogger();
    const code = await runListCommand(['bogus'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('Unknown subcommand');
  });

  it('lists notes in a real workspace directory as text', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha', 'beta.md': '# Beta' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runListCommand(['notes', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('alpha.md');
      expect(out).toContain('beta.md');
    }));

  it('lists notes as JSON', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha\n\n#work' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runListCommand(['notes', '--workspace', rootDir, '--format', 'json'], logger);
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('uri');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('tags');
    }));

  it('lists tags in a real workspace directory', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n#project #work', 'b.md': '# B\n\n#work' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runListCommand(['tags', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('#work');
      expect(out).toContain('#project');
    }));

  it('lists orphans in a real workspace directory', () =>
    withTmpWorkspace(
      { 'linked.md': '# Linked\n\n[[target]]', 'target.md': '# Target', 'orphan.md': '# Orphan' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runListCommand(['orphans', '--workspace', rootDir], logger);
        expect(code).toBe(0);
        const out = logger.logs.join('\n');
        expect(out).toContain('orphan.md');
        expect(out).not.toContain('linked.md');
        expect(out).not.toContain('target.md');
      }
    ));
});


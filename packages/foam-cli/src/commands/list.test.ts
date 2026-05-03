import path from 'node:path';
import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { FoamGraph, FoamTags, FoamWorkspace, URI } from '@foam/core';
import {
  InMemoryDataStore,
  createTestNote,
  createTestWorkspace,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = URI.file('/workspace');

function makeWorkspace(
  notes: ReturnType<typeof createTestNote>[]
): FoamWorkspace {
  const ws = createTestWorkspace([ROOT]);
  for (const note of notes) {
    ws.set(note);
  }
  return ws;
}

// ─── listNotes ────────────────────────────────────────────────────────────────

describe('listNotes', () => {
  it('returns all notes with id, path, title, type, tags', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', title: 'A', root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', title: 'B', root: ROOT }),
    ]);
    const result = listNotes(ws, '/workspace', {});
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'a')).toMatchObject({ title: 'A', type: 'note' });
    expect(result.find(r => r.id === 'b')).toMatchObject({ title: 'B', type: 'note' });
  });

  it('filters by type', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', title: 'A', type: 'note', root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', title: 'B', type: 'daily-note', root: ROOT }),
    ]);
    const result = listNotes(ws, '/workspace', { type: 'daily-note' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('filters by tag (AND for multiple tags)', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['work', 'project'], root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', tags: ['work'], root: ROOT }),
    ]);
    const result = listNotes(ws, '/workspace', { tags: ['work', 'project'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('limits results', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', root: ROOT }),
      createTestNote({ uri: '/workspace/c.md', root: ROOT }),
    ]);
    const result = listNotes(ws, '/workspace', { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('includes relative path from workspace root', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/notes/a.md', title: 'A', root: ROOT }),
    ]);
    const result = listNotes(ws, '/workspace', {});
    expect(result[0].path).toBe(path.join('notes', 'a.md'));
  });
});

// ─── listTags ─────────────────────────────────────────────────────────────────

describe('listTags', () => {
  it('returns tag name and count', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['foo', 'bar'], root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', tags: ['foo'], root: ROOT }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, {});
    expect(result.find(t => t.tag === 'foo')?.count).toBe(2);
    expect(result.find(t => t.tag === 'bar')?.count).toBe(1);
  });

  it('filters by prefix', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['work/project', 'personal'], root: ROOT }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, { prefix: 'work' });
    expect(result.map(t => t.tag)).toEqual(['work/project']);
  });

  it('sorts by count descending when sort=count', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['foo', 'bar'], root: ROOT }),
      createTestNote({ uri: '/workspace/b.md', tags: ['foo'], root: ROOT }),
    ]);
    const foamTags = FoamTags.fromWorkspace(ws);
    const result = listTags(foamTags, { sort: 'count' });
    expect(result[0].tag).toBe('foo');
  });

  it('sorts by name ascending by default', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', tags: ['zzz', 'aaa'], root: ROOT }),
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
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/linked.md', links: [{ slug: 'target' }], root: ROOT }),
      createTestNote({ uri: '/workspace/target.md', root: ROOT }),
      createTestNote({ uri: '/workspace/orphan.md', root: ROOT }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const result = listOrphans(ws, graph, '/workspace');
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
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/linked.md', links: [{ slug: 'target' }], root: ROOT }),
      createTestNote({ uri: '/workspace/target.md', root: ROOT }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const result = listDeadends(ws, graph, '/workspace');
    const ids = result.map(r => r.id);
    expect(ids).toContain('target');
    expect(ids).not.toContain('linked');
  });
});

// ─── listPlaceholders ────────────────────────────────────────────────────────

describe('listPlaceholders', () => {
  it('returns placeholder ids with referencing notes', () => {
    const ws = makeWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'missing-note' }], root: ROOT }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const result = listPlaceholders(ws, graph, '/workspace');
    expect(result).toHaveLength(1);
    expect(result[0].placeholder_id).toBe('missing-note');
    expect(result[0].referenced_by.map(r => r.id)).toContain('a');
  });
});

// ─── listTemplates ────────────────────────────────────────────────────────────

describe('listTemplates', () => {
  it('returns empty array when templates dir does not exist', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-list-test-'));
    try {
      const result = await listTemplates(tempDir);
      expect(result).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns templates from .foam/templates with description from frontmatter', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-list-test-'));
    try {
      const templatesDir = path.join(tempDir, '.foam', 'templates');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.writeFileSync(
        path.join(templatesDir, 'meeting.md'),
        [
          '---',
          'foam_template:',
          '  description: Template for meeting notes',
          '---',
          '',
          '# Meeting',
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(templatesDir, 'default.md'),
        '# Default',
        'utf8'
      );

      const result = await listTemplates(tempDir);
      const names = result.map(t => t.name);
      expect(names).toContain('meeting');
      expect(names).toContain('default');
      const meeting = result.find(t => t.name === 'meeting')!;
      expect(meeting.description).toBe('Template for meeting notes');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
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

  it('lists notes in a real workspace directory as text', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-list-test-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'alpha.md'), '# Alpha', 'utf8');
      fs.writeFileSync(path.join(tempDir, 'beta.md'), '# Beta', 'utf8');
      const logger = new TestLogger();
      const code = await runListCommand(['notes', '--workspace', tempDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('alpha.md');
      expect(out).toContain('beta.md');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists notes as JSON', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-list-test-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'alpha.md'), '# Alpha\n\n#work', 'utf8');
      const logger = new TestLogger();
      const code = await runListCommand(
        ['notes', '--workspace', tempDir, '--format', 'json'],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('uri');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('tags');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists tags in a real workspace directory', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-list-test-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'a.md'), '# A\n\n#project #work', 'utf8');
      fs.writeFileSync(path.join(tempDir, 'b.md'), '# B\n\n#work', 'utf8');
      const logger = new TestLogger();
      const code = await runListCommand(['tags', '--workspace', tempDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('#work');
      expect(out).toContain('#project');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists orphans in a real workspace directory', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-list-test-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'linked.md'), '# Linked\n\n[[target]]', 'utf8');
      fs.writeFileSync(path.join(tempDir, 'target.md'), '# Target', 'utf8');
      fs.writeFileSync(path.join(tempDir, 'orphan.md'), '# Orphan', 'utf8');
      const logger = new TestLogger();
      const code = await runListCommand(['orphans', '--workspace', tempDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('orphan.md');
      expect(out).not.toContain('linked.md');
      expect(out).not.toContain('target.md');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

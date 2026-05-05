import fs from 'node:fs';
import path from 'node:path';
import { FoamGraph } from '@foam/core';
import { setColorsEnabled } from '../support/colors';

setColorsEnabled(false);
import {
  createTestNote,
  createInMemoryWorkspace,
  withTmpWorkspace,
  TestLogger,
} from '../test/test-utils';
import {
  noteShowData,
  noteIdData,
  noteCreate,
  noteMove,
  noteDelete,
  runNoteCommand,
} from './note';
import { resolveNote } from '../support/workspace';

// ─── resolveNote ──────────────────────────────────────────────────────────────

describe('resolveNote', () => {
  it('resolves by identifier', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/alpha.md', title: 'Alpha' }),
    ]);
    const result = resolveNote(ws, 'alpha', undefined);
    expect(result.title).toBe('Alpha');
  });

  it('throws for unknown identifier', () => {
    const { workspace: ws } = createInMemoryWorkspace([]);
    expect(() => resolveNote(ws, 'missing', undefined)).toThrow('not found');
  });

  it('throws for ambiguous identifier with candidate list', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/notes/alpha.md' }),
      createTestNote({ uri: '/workspace/archive/alpha.md' }),
    ]);
    expect(() => resolveNote(ws, 'alpha', undefined)).toThrow('Ambiguous');
  });

  it('resolves by --path flag with an absolute path', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/alpha.md', title: 'Alpha' }),
    ]);
    const result = resolveNote(ws, undefined, '/workspace/alpha.md', root.toFsPath());
    expect(result.title).toBe('Alpha');
  });

  it('resolves by --path flag with a relative path against the workspace root', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/alpha.md', title: 'Alpha' }),
    ]);
    const result = resolveNote(ws, undefined, 'alpha.md', root.toFsPath());
    expect(result.title).toBe('Alpha');
  });

  it('throws when --path target does not exist in workspace', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([]);
    expect(() => resolveNote(ws, undefined, '/workspace/missing.md', root.toFsPath())).toThrow('not found');
  });
});

// ─── noteShowData ─────────────────────────────────────────────────────────────

describe('noteShowData', () => {
  it('returns metadata fields', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/alpha.md', title: 'Alpha', tags: ['work'], aliases: ['a'] }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const data = noteShowData(ws, graph, 'alpha', undefined, root.toFsPath(), {});
    expect(data.id).toBe('alpha');
    expect(data.title).toBe('Alpha');
    expect(data.tags).toEqual(['work']);
    expect(data.aliases).toEqual(['a']);
    expect(data.path).toBe('alpha.md');
  });

  it('includes links when includeLinks=true', () => {
    const { workspace: ws, root } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/a.md', links: [{ slug: 'b' }] }),
      createTestNote({ uri: '/workspace/b.md' }),
    ]);
    const graph = FoamGraph.fromWorkspace(ws);
    const data = noteShowData(ws, graph, 'a', undefined, root.toFsPath(), { includeLinks: true });
    expect(data.links?.outgoing).toContain('b');
    const dataB = noteShowData(ws, graph, 'b', undefined, root.toFsPath(), { includeLinks: true });
    expect(dataB.links?.incoming).toContain('a');
  });
});

// ─── noteIdData ───────────────────────────────────────────────────────────────

describe('noteIdData', () => {
  it('returns id and uri', () => {
    const { workspace: ws } = createInMemoryWorkspace([
      createTestNote({ uri: '/workspace/alpha.md' }),
    ]);
    const data = noteIdData(ws, 'alpha', undefined);
    expect(data.id).toBe('alpha');
    expect(data.uri).toContain('alpha.md');
  });
});

// ─── noteCreate ───────────────────────────────────────────────────────────────

describe('noteCreate', () => {
  it('creates a note file with title as H1', () =>
    withTmpWorkspace({}, async ({ rootDir, foam, dataStore }) => {
      const result = await noteCreate(rootDir, foam, dataStore, { title: 'My Note' });
      expect(result.id).toBe('my-note');
      expect(fs.existsSync(result.uri)).toBe(true);
      expect(fs.readFileSync(result.uri, 'utf8')).toContain('# My Note');
    }, 'foam-note-test-'));

  it('creates note in a subdirectory when --dir is given', () =>
    withTmpWorkspace({}, async ({ rootDir, foam, dataStore }) => {
      const result = await noteCreate(rootDir, foam, dataStore, { title: 'Sub Note', dir: 'notes' });
      expect(result.path).toBe(path.join('notes', 'sub-note.md'));
      expect(fs.existsSync(result.uri)).toBe(true);
    }, 'foam-note-test-'));

  it('includes extra properties in frontmatter', () =>
    withTmpWorkspace({}, async ({ rootDir, foam, dataStore }) => {
      const result = await noteCreate(rootDir, foam, dataStore, {
        title: 'Prop Note',
        properties: { status: 'active', priority: '1' },
      });
      const content = fs.readFileSync(result.uri, 'utf8');
      expect(content).toContain('status: active');
      expect(content).toContain('priority: 1');
    }, 'foam-note-test-'));

  it('errors if file already exists', () =>
    withTmpWorkspace({}, async ({ rootDir, foam, dataStore }) => {
      await noteCreate(rootDir, foam, dataStore, { title: 'Dup' });
      await expect(noteCreate(rootDir, foam, dataStore, { title: 'Dup' })).rejects.toThrow('already exists');
    }, 'foam-note-test-'));
});

// ─── noteMove ─────────────────────────────────────────────────────────────────

describe('noteMove', () => {
  it('moves the file and rewrites wikilinks', () =>
    withTmpWorkspace(
      { 'alpha.md': '# Alpha', 'ref.md': '# Ref\n\n[[alpha]]' },
      async ({ rootDir, workspace }) => {
        const graph = FoamGraph.fromWorkspace(workspace);
        const result = await noteMove(workspace, graph, rootDir, 'alpha', undefined, 'renamed.md');

        expect(result.old_id).toBe('alpha');
        expect(result.id).toBe('renamed');
        expect(fs.existsSync(path.join(rootDir, 'renamed.md'))).toBe(true);
        expect(fs.existsSync(path.join(rootDir, 'alpha.md'))).toBe(false);
        expect(result.updated_links).toBe(1);

        const refContent = fs.readFileSync(path.join(rootDir, 'ref.md'), 'utf8');
        expect(refContent).toContain('[[renamed]]');
        expect(refContent).not.toContain('[[alpha]]');
      },
      'foam-note-test-'
    ));

  it('errors if destination already exists', () =>
    withTmpWorkspace(
      { 'alpha.md': '# Alpha', 'beta.md': '# Beta' },
      async ({ rootDir, workspace }) => {
        const graph = FoamGraph.fromWorkspace(workspace);
        await expect(
          noteMove(workspace, graph, rootDir, 'alpha', undefined, 'beta.md')
        ).rejects.toThrow('already exists');
      },
      'foam-note-test-'
    ));
});

// ─── noteDelete ───────────────────────────────────────────────────────────────

describe('noteDelete', () => {
  it('moves note to .foam/trash/ by default', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha' }, async ({ rootDir, workspace }) => {
      const result = await noteDelete(workspace, rootDir, 'alpha', undefined, {});
      expect(result.trashed_uri).toBeTruthy();
      expect(result.trash_uri).toContain('.foam');
      expect(fs.existsSync(path.join(rootDir, 'alpha.md'))).toBe(false);
      expect(fs.existsSync(result.trash_uri!)).toBe(true);
    }, 'foam-note-test-'));

  it('generates collision-safe trash paths for notes with the same filename', () =>
    withTmpWorkspace(
      { 'notes/todo.md': '# Todo', 'archive/todo.md': '# Archived Todo' },
      async ({ rootDir, workspace }) => {
        await noteDelete(workspace, rootDir, undefined, path.join(rootDir, 'notes', 'todo.md'), {});
        await noteDelete(workspace, rootDir, undefined, path.join(rootDir, 'archive', 'todo.md'), {});

        expect(fs.existsSync(path.join(rootDir, '.foam', 'trash', 'notes', 'todo.md'))).toBe(true);
        expect(fs.existsSync(path.join(rootDir, '.foam', 'trash', 'archive', 'todo.md'))).toBe(true);
      },
      'foam-note-test-'
    ));

  it('permanently deletes with --permanent', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha' }, async ({ rootDir, workspace }) => {
      const result = await noteDelete(workspace, rootDir, 'alpha', undefined, { permanent: true });
      expect(result.deleted_uri).toBeTruthy();
      expect(fs.existsSync(path.join(rootDir, 'alpha.md'))).toBe(false);
    }, 'foam-note-test-'));
});

// ─── runNoteCommand (integration) ─────────────────────────────────────────────

describe('runNoteCommand', () => {
  it('shows help with --help', async () => {
    const logger = new TestLogger();
    const code = await runNoteCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam note');
  });

  it('returns exit 1 for unknown subcommand', async () => {
    const logger = new TestLogger();
    const code = await runNoteCommand(['bogus'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('Unknown subcommand');
  });

  it('show: prints text metadata for a note', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha\n\n#work' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runNoteCommand(['show', 'alpha', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('ID:');
      expect(out).toContain('alpha');
      expect(out).toContain('Alpha');
    }, 'foam-note-test-'));

  it('show: prints JSON metadata', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runNoteCommand(
        ['show', 'alpha', '--workspace', rootDir, '--format', 'json'],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'alpha');
      expect(result).toHaveProperty('title', 'Alpha');
    }, 'foam-note-test-'));

  it('show: prints raw content with --content', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha\n\nHello world' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runNoteCommand(
        ['show', 'alpha', '--workspace', rootDir, '--content'],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('Hello world');
    }, 'foam-note-test-'));

  it('id: prints the identifier', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runNoteCommand(['id', 'alpha', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs[0].trim()).toBe('alpha');
    }, 'foam-note-test-'));

  it('create: creates a note and reports path + id', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runNoteCommand(
        ['create', '--title', 'New Note', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('Created:');
      expect(logger.logs[0]).toContain('new-note');
      expect(fs.existsSync(path.join(rootDir, 'new-note.md'))).toBe(true);
    }, 'foam-note-test-'));

  it('move: moves note and reports updated links', () =>
    withTmpWorkspace(
      { 'alpha.md': '# Alpha', 'ref.md': '[[alpha]]' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runNoteCommand(
          ['move', 'alpha', '--to', 'renamed.md', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(0);
        expect(logger.logs[0]).toContain('Moved:');
        expect(logger.logs[0]).toContain('renamed');
        expect(fs.existsSync(path.join(rootDir, 'renamed.md'))).toBe(true);
      },
      'foam-note-test-'
    ));

  it('move: rewrites multiple links in the same referencing file', () =>
    withTmpWorkspace(
      {
        'alpha.md': '# Alpha',
        'ref.md': ['# Ref', '', 'First [[alpha]]', 'Second [[alpha]]'].join('\n'),
      },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runNoteCommand(
          ['move', 'alpha', '--to', 'renamed-note.md', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(0);
        const refContent = fs.readFileSync(path.join(rootDir, 'ref.md'), 'utf8');
        expect(refContent).toContain('First [[renamed-note]]');
        expect(refContent).toContain('Second [[renamed-note]]');
        expect(refContent).not.toContain('[[alpha]]');
      },
      'foam-note-test-'
    ));

  it('delete: requires --force in non-TTY context', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      // no opts.stdin → process.stdin.isTTY is false in test env
      const code = await runNoteCommand(['delete', 'alpha', '--workspace', rootDir], logger);
      expect(code).toBe(1);
      expect(logger.errors[0]).toContain('--force');
    }, 'foam-note-test-'));

  it('delete: trashes note with --force', () =>
    withTmpWorkspace({ 'alpha.md': '# Alpha' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runNoteCommand(
        ['delete', 'alpha', '--force', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('Trashed:');
      expect(fs.existsSync(path.join(rootDir, 'alpha.md'))).toBe(false);
    }, 'foam-note-test-'));
});

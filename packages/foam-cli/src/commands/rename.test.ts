import fs from 'node:fs';
import path from 'node:path';
import { FoamGraph, FoamTags } from '@foam/core';
import { createTmpWorkspace, TestLogger } from '../test/test-utils';
import {
  renameNote,
  renameTag,
  renameSection,
  renameBlock,
  runRenameCommand,
} from './rename';

// ─── renameNote ───────────────────────────────────────────────────────────────

describe('renameNote', () => {
  it('renames the file and rewrites wikilinks pointing to it', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'alpha.md': '# Alpha',
      'ref.md': '[[alpha]]',
    });
    try {
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await renameNote(workspace, graph, rootDir, 'alpha', undefined, 'renamed');

      expect(result.old_id).toBe('alpha');
      expect(result.id).toBe('renamed');
      expect(fs.existsSync(path.join(rootDir, 'renamed.md'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'alpha.md'))).toBe(false);
      expect(fs.readFileSync(path.join(rootDir, 'ref.md'), 'utf8')).toContain('[[renamed]]');
    } finally {
      cleanup();
    }
  });

  it('moves to a different directory when --target-path is given', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'alpha.md': '# Alpha',
      'archive/.keep': '',
    });
    try {
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await renameNote(workspace, graph, rootDir, 'alpha', undefined, 'alpha', 'archive');

      expect(fs.existsSync(path.join(rootDir, 'archive', 'alpha.md'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'alpha.md'))).toBe(false);
      expect(result.updated_links).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('errors when destination already exists', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'alpha.md': '# Alpha',
      'beta.md': '# Beta',
    });
    try {
      const graph = FoamGraph.fromWorkspace(workspace);
      await expect(
        renameNote(workspace, graph, rootDir, 'alpha', undefined, 'beta')
      ).rejects.toThrow('already exists');
    } finally {
      cleanup();
    }
  });

  it('errors when identifier is ambiguous', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'notes/alpha.md': '# Alpha',
      'archive/alpha.md': '# Alpha (archived)',
    });
    try {
      const graph = FoamGraph.fromWorkspace(workspace);
      await expect(
        renameNote(workspace, graph, rootDir, 'alpha', undefined, 'renamed')
      ).rejects.toThrow('Ambiguous');
    } finally {
      cleanup();
    }
  });
});

// ─── renameTag ────────────────────────────────────────────────────────────────

describe('renameTag', () => {
  it('renames a tag across all files', async () => {
    const { rootDir, foam, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#project',
      'b.md': '# B\n\n#project',
    });
    try {
      const tags = FoamTags.fromWorkspace(foam.workspace);
      const result = await renameTag(tags, rootDir, 'project', 'work', false);

      expect(result.old_tag).toBe('project');
      expect(result.new_tag).toBe('work');
      expect(result.updated_notes).toBe(2);
      expect(fs.readFileSync(path.join(rootDir, 'a.md'), 'utf8')).toContain('#work');
      expect(fs.readFileSync(path.join(rootDir, 'b.md'), 'utf8')).toContain('#work');
    } finally {
      cleanup();
    }
  });

  it('renames child tags hierarchically', async () => {
    const { rootDir, foam, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#project #project/frontend',
      'b.md': '# B\n\n#project/backend',
    });
    try {
      const tags = FoamTags.fromWorkspace(foam.workspace);
      await renameTag(tags, rootDir, 'project', 'work', false);

      expect(fs.readFileSync(path.join(rootDir, 'a.md'), 'utf8')).toContain('#work/frontend');
      expect(fs.readFileSync(path.join(rootDir, 'b.md'), 'utf8')).toContain('#work/backend');
    } finally {
      cleanup();
    }
  });

  it('errors when merging into existing tag without --force', async () => {
    const { rootDir, foam, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#project',
      'b.md': '# B\n\n#work',
    });
    try {
      const tags = FoamTags.fromWorkspace(foam.workspace);
      await expect(
        renameTag(tags, rootDir, 'project', 'work', false)
      ).rejects.toThrow('--force');
    } finally {
      cleanup();
    }
  });

  it('merges tags when --force is given', async () => {
    const { rootDir, foam, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#project',
      'b.md': '# B\n\n#work',
    });
    try {
      const tags = FoamTags.fromWorkspace(foam.workspace);
      const result = await renameTag(tags, rootDir, 'project', 'work', true);

      expect(result.old_tag).toBe('project');
      expect(result.new_tag).toBe('work');
      expect(fs.readFileSync(path.join(rootDir, 'a.md'), 'utf8')).toContain('#work');
      expect(fs.readFileSync(path.join(rootDir, 'b.md'), 'utf8')).toContain('#work');
    } finally {
      cleanup();
    }
  });
});

// ─── renameSection ────────────────────────────────────────────────────────────

describe('renameSection', () => {
  it('renames heading text and rewrites section links', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'note.md': '# Note\n\n## Goals\n\nsome text\n',
      'ref.md': '[[note#Goals]]',
    });
    try {
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await renameSection(workspace, graph, rootDir, 'note', undefined, 'Goals', 'Objectives');

      const noteContent = fs.readFileSync(path.join(rootDir, 'note.md'), 'utf8');
      expect(noteContent).toContain('## Objectives');
      expect(noteContent).not.toContain('## Goals');
      expect(result.updated_links).toBe(1);
    } finally {
      cleanup();
    }
  });
});

// ─── renameBlock ──────────────────────────────────────────────────────────────

describe('renameBlock', () => {
  it('renames block anchor and rewrites block links', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'note.md': '# Note\n\nsome text ^intro\n',
      'ref.md': '[[note#^intro]]',
    });
    try {
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await renameBlock(workspace, graph, rootDir, 'note', undefined, 'intro', 'overview');

      const noteContent = fs.readFileSync(path.join(rootDir, 'note.md'), 'utf8');
      expect(noteContent).toContain('^overview');
      expect(noteContent).not.toContain('^intro');
      expect(result.updated_links).toBe(1);
    } finally {
      cleanup();
    }
  });
});

// ─── runRenameCommand ─────────────────────────────────────────────────────────

describe('runRenameCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runRenameCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam rename');
  });

  it('errors for unknown subcommand', async () => {
    const logger = new TestLogger();
    const code = await runRenameCommand(['bogus'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('Unknown subcommand');
  });

  it('note: renames a note and reports result as text', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'alpha.md': '# Alpha' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(['note', 'alpha', 'beta', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('Renamed:');
      expect(logger.logs[0]).toContain('beta');
      expect(fs.existsSync(path.join(rootDir, 'beta.md'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('note: returns JSON output', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'alpha.md': '# Alpha' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['note', 'alpha', 'beta', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('old_id', 'alpha');
      expect(result).toHaveProperty('id', 'beta');
      expect(result).toHaveProperty('updated_links');
    } finally {
      cleanup();
    }
  });

  it('tag: renames a tag and reports result as text', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n\n#project' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(['tag', 'project', 'work', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('#project');
      expect(logger.logs[0]).toContain('#work');
    } finally {
      cleanup();
    }
  });

  it('tag: returns JSON output', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n\n#project' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['tag', 'project', 'work', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('old_tag', 'project');
      expect(result).toHaveProperty('new_tag', 'work');
      expect(result).toHaveProperty('updated_notes');
    } finally {
      cleanup();
    }
  });

  it('section: renames a section and reports result as text', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'note.md': '# Note\n\n## Goals\n' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['section', 'note', 'Goals', 'Objectives', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('Goals');
      expect(logger.logs[0]).toContain('Objectives');
    } finally {
      cleanup();
    }
  });

  it('section: returns JSON output', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'note.md': '# Note\n\n## Goals\n' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['section', 'note', 'Goals', 'Objectives', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'note');
      expect(result).toHaveProperty('updated_links');
    } finally {
      cleanup();
    }
  });

  it('block: renames a block anchor and reports result as text', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'note.md': '# Note\n\nsome text ^intro\n' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['block', 'note', 'intro', 'overview', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('intro');
      expect(logger.logs[0]).toContain('overview');
    } finally {
      cleanup();
    }
  });

  it('block: returns JSON output', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'note.md': '# Note\n\nsome text ^intro\n' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['block', 'note', 'intro', 'overview', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'note');
      expect(result).toHaveProperty('updated_links');
    } finally {
      cleanup();
    }
  });

  it('note: errors when note is not found', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'alpha.md': '# Alpha' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['note', 'missing', 'beta', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(1);
      expect(logger.errors[0]).toContain('missing');
    } finally {
      cleanup();
    }
  });

  it('note: errors when new-name argument is missing', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'alpha.md': '# Alpha' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(['note', 'alpha', '--workspace', rootDir], logger);
      expect(code).toBe(1);
      expect(logger.errors[0]).toContain('Usage:');
    } finally {
      cleanup();
    }
  });

  it('tag: errors when tag is not found', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n\n#work' });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['tag', 'missing', 'other', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(1);
      expect(logger.errors[0]).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  it('tag: errors when merging without --force', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#project',
      'b.md': '# B\n\n#work',
    });
    try {
      const logger = new TestLogger();
      const code = await runRenameCommand(
        ['tag', 'project', 'work', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(1);
      expect(logger.errors[0]).toContain('--force');
    } finally {
      cleanup();
    }
  });
});

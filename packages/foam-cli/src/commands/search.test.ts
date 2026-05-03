import {
  searchWorkspace,
  formatSearchText,
  runSearchCommand,
  type PropertyFilter,
} from './search';
import { createTmpWorkspace, TestLogger } from '../test/test-utils';

// ─── searchWorkspace (domain) ─────────────────────────────────────────────────

describe('searchWorkspace', () => {
  it('returns all notes when no filters given', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'alpha.md': '# Alpha\n\nSome content.',
      'beta.md': '# Beta\n\nSome content.',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, {});
      expect(results.length).toBe(2);
    } finally {
      cleanup();
    }
  });

  it('filters by title query (case-insensitive substring)', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'project-management.md': '# Project Management\n',
      'ideas.md': '# Project Ideas\n',
      'diary.md': '# Diary\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { query: 'project' });
      const titles = results.map(r => r.title);
      expect(titles).toContain('Project Management');
      expect(titles).toContain('Project Ideas');
      expect(titles).not.toContain('Diary');
    } finally {
      cleanup();
    }
  });

  it('filters by alias', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'project-management.md': '---\nalias: [pm]\n---\n# Project Management\n',
      'ideas.md': '# Ideas\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { query: 'pm' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Project Management');
    } finally {
      cleanup();
    }
  });

  it('filters by single tag', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#work\n',
      'b.md': '# B\n\n#personal\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { tags: ['work'] });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('A');
    } finally {
      cleanup();
    }
  });

  it('filters by multiple tags (AND)', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n\n#work #project\n',
      'b.md': '# B\n\n#work\n',
      'c.md': '# C\n\n#project\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { tags: ['work', 'project'] });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('A');
    } finally {
      cleanup();
    }
  });

  it('filters by frontmatter property with value', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'active.md': '---\nstatus: active\n---\n# Active\n',
      'draft.md': '---\nstatus: draft\n---\n# Draft\n',
    });
    try {
      const filters: PropertyFilter[] = [{ key: 'status', value: 'active' }];
      const results = searchWorkspace(workspace, rootDir, { properties: filters });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Active');
    } finally {
      cleanup();
    }
  });

  it('filters by frontmatter property existence (no value)', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'has-status.md': '---\nstatus: done\n---\n# Has Status\n',
      'no-status.md': '# No Status\n',
    });
    try {
      const filters: PropertyFilter[] = [{ key: 'status' }];
      const results = searchWorkspace(workspace, rootDir, { properties: filters });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Has Status');
    } finally {
      cleanup();
    }
  });

  it('filters by type', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'note.md': '# Note\n',
      'journals/2026-05-01.md': '# Daily\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { type: 'note' });
      // Both are parsed as 'note' type (daily-note detection needs config);
      // just verify the type filter applies without error
      results.forEach(r => expect(r.type).toBe('note'));
    } finally {
      cleanup();
    }
  });

  it('respects limit', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'a.md': '# A\n',
      'b.md': '# B\n',
      'c.md': '# C\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    } finally {
      cleanup();
    }
  });

  it('returns match with id, uri, title, type, tags, properties, line, text', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'project.md': '---\nstatus: active\n---\n# Project\n\n#work\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { query: 'project' });
      expect(results).toHaveLength(1);
      const r = results[0];
      expect(r.id).toBe('project');
      expect(r.uri).toContain('project.md');
      expect(r.title).toBe('Project');
      expect(r.line).toBe(1);
      expect(r.text).toBe('# Project');
      expect(r.tags).toContain('work');
      expect(r.properties['status']).toBe('active');
    } finally {
      cleanup();
    }
  });

  it('includes empty context arrays when context > 0', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'a.md': '# Alpha\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { context: 2 });
      expect(results[0].context_before).toEqual([]);
      expect(results[0].context_after).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('returns empty when query matches nothing', async () => {
    const { rootDir, workspace, cleanup } = await createTmpWorkspace({
      'a.md': '# Alpha\n',
    });
    try {
      const results = searchWorkspace(workspace, rootDir, { query: 'xyzzy-no-match' });
      expect(results).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
});

// ─── formatSearchText ─────────────────────────────────────────────────────────

describe('formatSearchText', () => {
  it('returns empty string for no matches', () => {
    const out = formatSearchText([], '/workspace', {});
    expect(out).toBe('');
  });

  it('formats as path:line: text by default', () => {
    const match = {
      id: 'project',
      uri: '/workspace/notes/project.md',
      title: 'Project',
      type: 'note',
      tags: [],
      properties: {},
      line: 1,
      text: '# Project',
    };
    const out = formatSearchText([match], '/workspace', {});
    expect(out).toBe('notes/project.md:1: # Project');
  });

  it('omits line number with noLineNumber', () => {
    const match = {
      id: 'project',
      uri: '/workspace/notes/project.md',
      title: 'Project',
      type: 'note',
      tags: [],
      properties: {},
      line: 1,
      text: '# Project',
    };
    const out = formatSearchText([match], '/workspace', { noLineNumber: true });
    expect(out).toBe('notes/project.md: # Project');
  });
});

// ─── runSearchCommand ─────────────────────────────────────────────────────────

describe('runSearchCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runSearchCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam search');
  });

  it('returns 0 with no args (filter-only mode)', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# A\n' });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(['--workspace', rootDir], logger);
      expect(code).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('prints grep-style text output', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'project.md': '# My Project\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(['project', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toMatch(/project\.md:1:/);
      expect(out).toContain('# My Project');
    } finally {
      cleanup();
    }
  });

  it('--no-line-number omits line number', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'project.md': '# My Project\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['project', '--no-line-number', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).not.toMatch(/:\d+:/);
      expect(out).toContain('# My Project');
    } finally {
      cleanup();
    }
  });

  it('returns JSON with required fields', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'project.md': '---\nstatus: active\n---\n# My Project\n\n#work\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['project', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(Array.isArray(result)).toBe(true);
      const r = result[0];
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('uri');
      expect(r).toHaveProperty('title', 'My Project');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('tags');
      expect(r).toHaveProperty('properties');
      expect(r).toHaveProperty('line', 1);
      expect(r).toHaveProperty('text', '# My Project');
    } finally {
      cleanup();
    }
  });

  it('JSON includes context_before/after with --context', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'project.md': '# My Project\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['project', '--context', '2', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result[0]).toHaveProperty('context_before');
      expect(result[0]).toHaveProperty('context_after');
    } finally {
      cleanup();
    }
  });

  it('--tag filters results', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'a.md': '# Alpha\n\n#work\n',
      'b.md': '# Beta\n\n#personal\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['--tag', 'work', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('# Alpha');
      expect(out).not.toContain('# Beta');
    } finally {
      cleanup();
    }
  });

  it('--property key=val filters by frontmatter value', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'active.md': '---\nstatus: active\n---\n# Active\n',
      'draft.md': '---\nstatus: draft\n---\n# Draft\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['--property', 'status=active', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('# Active');
      expect(out).not.toContain('# Draft');
    } finally {
      cleanup();
    }
  });

  it('--property key (no value) filters by property existence', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'has-status.md': '---\nstatus: done\n---\n# Has Status\n',
      'no-status.md': '# No Status\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['--property', 'status', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('# Has Status');
      expect(out).not.toContain('# No Status');
    } finally {
      cleanup();
    }
  });

  it('returns exit 0 with no matches, prints nothing', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# Alpha\n' });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(['xyzzy-no-match', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs.join('')).toBe('');
    } finally {
      cleanup();
    }
  });

  it('returns an empty JSON array with no matches', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({ 'a.md': '# Alpha\n' });
    try {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['xyzzy-no-match', '--format', 'json', '--workspace', rootDir],
        logger
      );

      expect(code).toBe(0);
      expect(JSON.parse(logger.logs[0])).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

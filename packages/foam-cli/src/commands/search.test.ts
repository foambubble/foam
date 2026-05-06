import {
  searchWorkspace,
  formatSearchText,
  runSearchCommand,
  type PropertyFilter,
} from './search';
import {
  createInMemoryWorkspace,
  createTestNote,
  withTmpWorkspace,
  TestLogger,
} from '../test/test-utils';
import { setColorsEnabled } from '../support/colors';

setColorsEnabled(false);

// ─── searchWorkspace (domain) ─────────────────────────────────────────────────

describe('searchWorkspace', () => {
  it('returns all notes when no filters given', () =>
    withTmpWorkspace(
      { 'alpha.md': '# Alpha\n\nSome content.', 'beta.md': '# Beta\n\nSome content.' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, {});
        expect(results.length).toBe(2);
      }
    ));

  it('filters by title query (case-insensitive substring)', () =>
    withTmpWorkspace(
      { 'project-management.md': '# Project Management\n', 'ideas.md': '# Project Ideas\n', 'diary.md': '# Diary\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { query: 'project' });
        const titles = results.map(r => r.title);
        expect(titles).toContain('Project Management');
        expect(titles).toContain('Project Ideas');
        expect(titles).not.toContain('Diary');
      }
    ));

  it('filters by alias', () =>
    withTmpWorkspace(
      { 'project-management.md': '---\nalias: [pm]\n---\n# Project Management\n', 'ideas.md': '# Ideas\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { query: 'pm' });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Project Management');
      }
    ));

  it('filters by single tag', () =>
    withTmpWorkspace(
      { 'a.md': '# A\n\n#work\n', 'b.md': '# B\n\n#personal\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { tags: ['work'] });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('A');
      }
    ));

  it('filters by multiple tags (AND)', () =>
    withTmpWorkspace(
      { 'a.md': '# A\n\n#work #project\n', 'b.md': '# B\n\n#work\n', 'c.md': '# C\n\n#project\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { tags: ['work', 'project'] });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('A');
      }
    ));

  it('filters by frontmatter property with value', () =>
    withTmpWorkspace(
      { 'active.md': '---\nstatus: active\n---\n# Active\n', 'draft.md': '---\nstatus: draft\n---\n# Draft\n' },
      async ({ workspace }) => {
        const filters: PropertyFilter[] = [{ key: 'status', value: 'active' }];
        const results = searchWorkspace(workspace, { properties: filters });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Active');
      }
    ));

  it('filters by frontmatter property existence (no value)', () =>
    withTmpWorkspace(
      { 'has-status.md': '---\nstatus: done\n---\n# Has Status\n', 'no-status.md': '# No Status\n' },
      async ({ workspace }) => {
        const filters: PropertyFilter[] = [{ key: 'status' }];
        const results = searchWorkspace(workspace, { properties: filters });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Has Status');
      }
    ));

  it('filters by type', () =>
    withTmpWorkspace(
      { 'note.md': '# Note\n', 'journals/2026-05-01.md': '# Daily\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { type: 'note' });
        // Both are parsed as 'note' type (daily-note detection needs config);
        // just verify the type filter applies without error
        results.forEach(r => expect(r.type).toBe('note'));
      }
    ));

  it('respects limit', () =>
    withTmpWorkspace(
      { 'a.md': '# A\n', 'b.md': '# B\n', 'c.md': '# C\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { limit: 2 });
        expect(results.length).toBeLessThanOrEqual(2);
      }
    ));

  it('returns match with id, uri, title, type, tags, properties, line, text', () =>
    withTmpWorkspace(
      { 'project.md': '---\nstatus: active\n---\n# Project\n\n#work\n' },
      async ({ workspace }) => {
        const results = searchWorkspace(workspace, { query: 'project' });
        expect(results).toHaveLength(1);
        const r = results[0];
        expect(r.id).toBe('project');
        expect(r.uri.path).toContain('project.md');
        expect(r.title).toBe('Project');
        expect(r.line).toBe(1);
        expect(r.text).toBe('# Project');
        expect(r.tags).toContain('work');
        expect(r.properties['status']).toBe('active');
      }
    ));

  it('includes empty context arrays when context > 0', () =>
    withTmpWorkspace({ 'a.md': '# Alpha\n' }, async ({ workspace }) => {
      const results = searchWorkspace(workspace, { context: 2 });
      expect(results[0].context_before).toEqual([]);
      expect(results[0].context_after).toEqual([]);
    }));

  it('returns empty when query matches nothing', () =>
    withTmpWorkspace({ 'a.md': '# Alpha\n' }, async ({ workspace }) => {
      const results = searchWorkspace(workspace, { query: 'xyzzy-no-match' });
      expect(results).toHaveLength(0);
    }));
});

// ─── formatSearchText ─────────────────────────────────────────────────────────

describe('formatSearchText', () => {
  it('returns empty string for no matches', () => {
    const { workspace } = createInMemoryWorkspace([]);
    const out = formatSearchText([], workspace, {});
    expect(out).toBe('');
  });

  it('formats as path:line: text by default', () => {
    const { workspace } = createInMemoryWorkspace([
      createTestNote({
        uri: '/workspace/notes/project.md',
        title: 'Project',
      }),
    ]);
    const matches = searchWorkspace(workspace, { query: 'Project' });
    const out = formatSearchText(matches, workspace, {});
    expect(out).toBe('notes/project.md:1: # Project');
  });

  it('omits line number with noLineNumber', () => {
    const { workspace } = createInMemoryWorkspace([
      createTestNote({
        uri: '/workspace/notes/project.md',
        title: 'Project',
      }),
    ]);
    const matches = searchWorkspace(workspace, { query: 'Project' });
    const out = formatSearchText(matches, workspace, { noLineNumber: true });
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

  it('returns 0 with no args (filter-only mode)', () =>
    withTmpWorkspace({ 'a.md': '# A\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runSearchCommand(['--workspace', rootDir], logger);
      expect(code).toBe(0);
    }));

  it('prints grep-style text output', () =>
    withTmpWorkspace({ 'project.md': '# My Project\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runSearchCommand(['project', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toMatch(/project\.md:1:/);
      expect(out).toContain('# My Project');
    }));

  it('--no-line-number omits line number', () =>
    withTmpWorkspace({ 'project.md': '# My Project\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['project', '--no-line-number', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).not.toMatch(/:\d+:/);
      expect(out).toContain('# My Project');
    }));

  it('returns JSON with required fields', () =>
    withTmpWorkspace(
      { 'project.md': '---\nstatus: active\n---\n# My Project\n\n#work\n' },
      async ({ rootDir }) => {
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
      }
    ));

  it('JSON includes context_before/after with --context', () =>
    withTmpWorkspace({ 'project.md': '# My Project\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['project', '--context', '2', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result[0]).toHaveProperty('context_before');
      expect(result[0]).toHaveProperty('context_after');
    }));

  it('--tag filters results', () =>
    withTmpWorkspace(
      { 'a.md': '# Alpha\n\n#work\n', 'b.md': '# Beta\n\n#personal\n' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runSearchCommand(['--tag', 'work', '--workspace', rootDir], logger);
        expect(code).toBe(0);
        const out = logger.logs.join('\n');
        expect(out).toContain('# Alpha');
        expect(out).not.toContain('# Beta');
      }
    ));

  it('--property key=val filters by frontmatter value', () =>
    withTmpWorkspace(
      { 'active.md': '---\nstatus: active\n---\n# Active\n', 'draft.md': '---\nstatus: draft\n---\n# Draft\n' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runSearchCommand(
          ['--property', 'status=active', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(0);
        const out = logger.logs.join('\n');
        expect(out).toContain('# Active');
        expect(out).not.toContain('# Draft');
      }
    ));

  it('--property key (no value) filters by property existence', () =>
    withTmpWorkspace(
      { 'has-status.md': '---\nstatus: done\n---\n# Has Status\n', 'no-status.md': '# No Status\n' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runSearchCommand(
          ['--property', 'status', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(0);
        const out = logger.logs.join('\n');
        expect(out).toContain('# Has Status');
        expect(out).not.toContain('# No Status');
      }
    ));

  it('returns exit 0 with no matches, prints nothing', () =>
    withTmpWorkspace({ 'a.md': '# Alpha\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runSearchCommand(['xyzzy-no-match', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs.join('')).toBe('');
    }));

  it('returns an empty JSON array with no matches', () =>
    withTmpWorkspace({ 'a.md': '# Alpha\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runSearchCommand(
        ['xyzzy-no-match', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(JSON.parse(logger.logs[0])).toEqual([]);
    }));
});

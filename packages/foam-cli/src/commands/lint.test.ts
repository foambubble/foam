import fs from 'node:fs';
import path from 'node:path';
import { buildRules, formatLintText, runLintCommand, type LintResult } from './lint';
import { createTmpWorkspace, TestLogger } from '../test/test-utils';

// ─── buildRules ───────────────────────────────────────────────────────────────

describe('buildRules', () => {
  it('returns both rules when no filter given', () => {
    const rules = buildRules([]);
    expect(rules.map(r => r.id)).toEqual(['missing-heading', 'stale-definitions']);
  });

  it('returns only missing-heading when filtered', () => {
    const rules = buildRules(['missing-heading']);
    expect(rules.map(r => r.id)).toEqual(['missing-heading']);
  });

  it('returns only stale-definitions when filtered', () => {
    const rules = buildRules(['stale-definitions']);
    expect(rules.map(r => r.id)).toEqual(['stale-definitions']);
  });
});

// ─── formatLintText ───────────────────────────────────────────────────────────

describe('formatLintText', () => {
  it('returns empty string with no results', () => {
    expect(formatLintText([])).toBe('');
  });

  it('formats ESLint-style output', () => {
    const results: LintResult[] = [
      {
        uri: '/workspace/notes/project.md',
        path: 'notes/project.md',
        issues: [
          { code: 'missing-heading', message: 'Note is missing an h1 heading', line: 1, column: 1, fixable: true },
        ],
      },
    ];
    const out = formatLintText(results);
    expect(out).toContain('notes/project.md');
    expect(out).toContain('1:1');
    expect(out).toContain('missing-heading');
    expect(out).toContain('fixable');
    expect(out).toContain('1 problem');
  });

  it('includes summary with counts', () => {
    const results: LintResult[] = [
      {
        uri: '/w/a.md',
        path: 'a.md',
        issues: [
          { code: 'missing-heading', message: 'msg', line: 1, column: 1, fixable: true },
          { code: 'stale-definitions', message: 'msg', line: 5, column: 1, fixable: true },
        ],
      },
    ];
    const out = formatLintText(results);
    expect(out).toContain('2 problems');
    expect(out).toContain('2 fixable');
  });
});

// ─── runLintCommand ───────────────────────────────────────────────────────────

describe('runLintCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runLintCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam lint');
  });

  it('returns exit 0 when workspace has no issues', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'clean.md': '# Clean Note\n\nNo issues here.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(['--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.errors).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('returns exit 2 when issues are found', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'no-heading.md': 'No heading here.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(['--workspace', rootDir], logger);
      expect(code).toBe(2);
    } finally {
      cleanup();
    }
  });

  it('reports missing-heading issue in text format', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'no-heading.md': 'Content without a heading.\n',
    });
    try {
      const logger = new TestLogger();
      await runLintCommand(['--workspace', rootDir], logger);
      const out = logger.logs.join('\n');
      expect(out).toContain('no-heading.md');
      expect(out).toContain('missing-heading');
    } finally {
      cleanup();
    }
  });

  it('returns JSON array with --format json', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'no-heading.md': 'Content without a heading.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(['--format', 'json', '--workspace', rootDir], logger);
      expect(code).toBe(2);
      const result = JSON.parse(logger.logs[0]);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('path');
      expect(result[0]).toHaveProperty('issues');
      expect(result[0].issues[0]).toHaveProperty('code', 'missing-heading');
      expect(result[0].issues[0]).toHaveProperty('line');
      expect(result[0].issues[0]).toHaveProperty('fixable', true);
    } finally {
      cleanup();
    }
  });

  it('returns empty JSON array when no issues', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'clean.md': '# Clean\n\nFine.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(['--format', 'json', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('--rule filters to only the given rule', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'no-heading.md': 'Content without a heading.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(
        ['--rule', 'missing-heading', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(2);
      const out = logger.logs.join('\n');
      expect(out).toContain('missing-heading');
      expect(out).not.toContain('stale-definitions');
    } finally {
      cleanup();
    }
  });

  it('returns error for unknown --rule', async () => {
    const logger = new TestLogger();
    const code = await runLintCommand(['--rule', 'nonexistent-rule'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('nonexistent-rule');
  });

  it('--fix applies fixable issues and returns exit 0', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'no-heading.md': 'Content without a heading.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(['--fix', '--workspace', rootDir], logger);
      expect(code).toBe(0);

      const fixedContent = fs.readFileSync(
        path.join(rootDir, 'no-heading.md'),
        'utf8'
      );
      expect(fixedContent).toContain('# no-heading');
    } finally {
      cleanup();
    }
  });

  it('--fix with no fixable issues reports nothing to fix', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'clean.md': '# Clean\n\nFine.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(['--fix', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs.join('')).toContain('No fixable');
    } finally {
      cleanup();
    }
  });

  it('--fix with --format json returns fixed count', async () => {
    const { rootDir, cleanup } = await createTmpWorkspace({
      'no-heading.md': 'Content without a heading.\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runLintCommand(
        ['--fix', '--format', 'json', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('fixed');
      expect(result.fixed).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });
});

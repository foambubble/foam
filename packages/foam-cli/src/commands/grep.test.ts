import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { grepFiles, formatGrepText, runGrepCommand } from './grep';
import { TestLogger } from '../test/test-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkspace(files: Record<string, string>): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-grep-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(tempDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return tempDir;
}

// ─── grepFiles (domain) ───────────────────────────────────────────────────────

describe('grepFiles', () => {
  it('returns matches from a list of files', async () => {
    const dir = makeWorkspace({
      'alpha.md': '# Alpha\n\nThis is about machine learning.\n',
      'beta.md': '# Beta\n\nNothing relevant here.\n',
    });
    try {
      const files = [path.join(dir, 'alpha.md'), path.join(dir, 'beta.md')];
      const results = await grepFiles(files, 'machine learning');
      expect(results).toHaveLength(1);
      expect(results[0].uri).toContain('alpha.md');
      expect(results[0].line).toBe(3);
      expect(results[0].text).toContain('machine learning');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns multiple matches within the same file', async () => {
    const dir = makeWorkspace({
      'notes.md': 'project A\nproject B\nno match\nproject C\n',
    });
    try {
      const results = await grepFiles([path.join(dir, 'notes.md')], 'project');
      expect(results).toHaveLength(3);
      expect(results.map(r => r.line)).toEqual([1, 2, 4]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is case-insensitive by default', async () => {
    const dir = makeWorkspace({ 'a.md': 'Hello World\nhello world\n' });
    try {
      const results = await grepFiles([path.join(dir, 'a.md')], 'hello world');
      expect(results).toHaveLength(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('respects limit (max matching files)', async () => {
    const fileMap: Record<string, string> = {};
    for (let i = 0; i < 5; i++) fileMap[`note${i}.md`] = 'match\n';
    const dir = makeWorkspace(fileMap);
    try {
      const filePaths = Object.keys(fileMap).map(f => path.join(dir, f));
      const results = await grepFiles(filePaths, 'match', { limit: 2 });
      const matchingFiles = new Set(results.map(r => r.uri));
      expect(matchingFiles.size).toBeLessThanOrEqual(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns context_before and context_after when context > 0', async () => {
    const dir = makeWorkspace({
      'a.md': 'line one\nline two\nMATCH line\nline four\nline five\n',
    });
    try {
      const results = await grepFiles([path.join(dir, 'a.md')], 'MATCH', { context: 2 });
      expect(results).toHaveLength(1);
      expect(results[0].context_before).toEqual(['line one', 'line two']);
      expect(results[0].context_after).toEqual(['line four', 'line five']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('assigns correct line numbers to context lines when surrounding text is identical', async () => {
    // Lines 1 and 2 are identical — indexOf would return 0 for both, producing wrong line numbers.
    const dir = makeWorkspace({ 'a.md': 'repeated\nrepeated\nbefore match\nMATCH\n' });
    try {
      const results = await grepFiles([path.join(dir, 'a.md')], 'MATCH', { context: 3 });
      const out = formatGrepText(results, dir, { context: 3 });
      const lines = out.split('\n');
      expect(lines).toContain('a.md-1- repeated');
      expect(lines).toContain('a.md-2- repeated');
      expect(lines).toContain('a.md-3- before match');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty array when no matches', async () => {
    const dir = makeWorkspace({ 'a.md': 'nothing to see here\n' });
    try {
      const results = await grepFiles([path.join(dir, 'a.md')], 'xyzzy');
      expect(results).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── runGrepCommand ───────────────────────────────────────────────────────────

describe('runGrepCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runGrepCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam grep');
  });

  it('errors when no pattern given', async () => {
    const logger = new TestLogger();
    const code = await runGrepCommand([], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('pattern');
  });

  it('prints grep-style text output with line numbers', async () => {
    const dir = makeWorkspace({ 'notes.md': '# Notes\n\nproject alpha\n' });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(['project', '--workspace', dir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toMatch(/notes\.md:3:/);
      expect(out).toContain('project alpha');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--no-line-number omits the line number', async () => {
    const dir = makeWorkspace({ 'notes.md': 'project alpha\n' });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(
        ['project', '--no-line-number', '--workspace', dir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).not.toMatch(/:\d+:/);
      expect(out).toContain('project alpha');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns JSON output with uri, line, text', async () => {
    const dir = makeWorkspace({ 'notes.md': 'project alpha\n' });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(
        ['project', '--format', 'json', '--workspace', dir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('uri');
      expect(result[0]).toHaveProperty('line', 1);
      expect(result[0]).toHaveProperty('text', 'project alpha');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('JSON includes context_before/after with --context', async () => {
    const dir = makeWorkspace({
      'a.md': 'before\nMATCH\nafter\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(
        ['MATCH', '--context', '1', '--format', 'json', '--workspace', dir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result[0].context_before).toEqual(['before']);
      expect(result[0].context_after).toEqual(['after']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips .git and node_modules (uses workspace file list)', async () => {
    const dir = makeWorkspace({
      'notes.md': 'match here\n',
      '.git/HEAD': 'match here\n',
      'node_modules/pkg/index.md': 'match here\n',
    });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(['match here', '--workspace', dir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('notes.md');
      expect(out).not.toContain('.git');
      expect(out).not.toContain('node_modules');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns exit 0 with no matches', async () => {
    const dir = makeWorkspace({ 'a.md': 'nothing\n' });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(['xyzzy', '--workspace', dir], logger);
      expect(code).toBe(0);
      expect(logger.logs.join('')).toBe('');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty JSON array with no matches', async () => {
    const dir = makeWorkspace({ 'a.md': 'nothing\n' });
    try {
      const logger = new TestLogger();
      const code = await runGrepCommand(
        ['xyzzy', '--format', 'json', '--workspace', dir],
        logger
      );

      expect(code).toBe(0);
      expect(JSON.parse(logger.logs[0])).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

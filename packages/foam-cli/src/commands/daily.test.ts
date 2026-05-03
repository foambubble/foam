import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { parseDateArg, defaultDailyNotePath, runDailyCommand } from './daily';
import { TestLogger } from '../test/test-utils';

// ─── parseDateArg ─────────────────────────────────────────────────────────────

describe('parseDateArg', () => {
  it('returns today when no arg given', () => {
    const result = parseDateArg(undefined);
    const today = new Date();
    expect(result.getFullYear()).toBe(today.getFullYear());
    expect(result.getMonth()).toBe(today.getMonth());
    expect(result.getDate()).toBe(today.getDate());
  });

  it('parses a YYYY-MM-DD string', () => {
    const result = parseDateArg('2026-05-01');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // 0-indexed
    expect(result.getDate()).toBe(1);
  });

  it('throws for an invalid date string', () => {
    expect(() => parseDateArg('not-a-date')).toThrow('Invalid date');
  });
});

// ─── defaultDailyNotePath ─────────────────────────────────────────────────────

describe('defaultDailyNotePath', () => {
  it('returns journals/YYYY-MM-DD.md', () => {
    const date = new Date('2026-05-01T00:00:00');
    const result = defaultDailyNotePath(date, '/workspace');
    expect(result).toBe(path.join('/workspace', 'journals', '2026-05-01.md'));
  });

  it('zero-pads month and day', () => {
    const date = new Date('2026-03-07T00:00:00');
    const result = defaultDailyNotePath(date, '/workspace');
    expect(result).toContain('2026-03-07.md');
  });
});

// ─── runDailyCommand ──────────────────────────────────────────────────────────

describe('runDailyCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runDailyCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam daily');
  });

  it('shows the resolved path and [does not exist] for a future date', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-daily-test-'));
    try {
      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      const out = logger.logs[0];
      expect(out).toContain('2099-12-31.md');
      expect(out).toContain('[does not exist]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('shows [exists] when the daily note already exists', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-daily-test-'));
    try {
      const journalsDir = path.join(tempDir, 'journals');
      fs.mkdirSync(journalsDir, { recursive: true });
      fs.writeFileSync(path.join(journalsDir, '2026-05-01.md'), '# 2026-05-01\n', 'utf8');

      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2026-05-01', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('[exists]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('--create creates the file when it does not exist', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-daily-test-'));
    try {
      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--create', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      const notePath = path.join(tempDir, 'journals', '2099-12-31.md');
      expect(fs.existsSync(notePath)).toBe(true);
      expect(logger.logs[0]).toContain('2099-12-31');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('--path-only prints the bare path', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-daily-test-'));
    try {
      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--path-only', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('2099-12-31.md');
      expect(logger.logs[0]).not.toContain('[');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns JSON with id, uri, exists', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-daily-test-'));
    try {
      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--format', 'json', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('uri');
      expect(result).toHaveProperty('exists', false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses a daily-note.md template when present', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-daily-test-'));
    try {
      const templatesDir = path.join(tempDir, '.foam', 'templates');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.writeFileSync(
        path.join(templatesDir, 'daily-note.md'),
        [
          '---',
          'foam_template:',
          '  filepath: "journals/$FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE.md"',
          '---',
          '',
          '# $FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE',
          '',
          '## Notes',
        ].join('\n'),
        'utf8'
      );

      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--create', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      const notePath = path.join(tempDir, 'journals', '2099-12-31.md');
      expect(fs.existsSync(notePath)).toBe(true);
      const content = fs.readFileSync(notePath, 'utf8');
      expect(content).toContain('## Notes');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

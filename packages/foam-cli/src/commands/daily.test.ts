import fs from 'node:fs';
import path from 'node:path';
import { parseDateArg, runDailyCommand } from './daily';
import type { CommandRunResult } from '../support/with-telemetry';
import { withTmpWorkspace, TestLogger } from '../test/test-utils';
import { setColorsEnabled } from '../support/colors';

setColorsEnabled(false);

function exitCodeOf(result: CommandRunResult): number {
  return typeof result === 'number' ? result : result.exitCode;
}

function telemetryOf(
  result: CommandRunResult
): Record<string, string> | undefined {
  return typeof result === 'number' ? undefined : result.telemetryProperties;
}

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

  it('throws for a calendar-rollover date and hints at the normalized date', () => {
    expect(() => parseDateArg('2026-02-31')).toThrow('did you mean 2026-03-03');
  });
});

// ─── Where the note goes ──────────────────────────────────────────────────────

describe('where foam daily puts the note without a template', () => {
  it('prints journal/YYYY-MM-DD.md when neither a template nor the settings place it', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(['--date', '2026-05-01', '--path-only', '--workspace', rootDir], logger);
      expect(exitCodeOf(code)).toBe(0);
      expect(logger.logs[0]).toBe(path.join(rootDir, 'journal', '2026-05-01.md'));
    }));

  it('follows the openDailyNote settings when they are set', () =>
    withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({
          'foam.openDailyNote.directory': 'diary',
          'foam.openDailyNote.filenameFormat': 'dd-mm-yyyy',
        }),
      },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runDailyCommand(['--date', '2026-05-01', '--path-only', '--workspace', rootDir], logger);
        expect(exitCodeOf(code)).toBe(0);
        expect(logger.logs[0]).toBe(path.join(rootDir, 'diary', '01-05-2026.md'));
      }
    ));
});

// ─── What the new note contains ───────────────────────────────────────────────

describe('what foam daily writes into a new note', () => {
  const createNote = async (rootDir: string, date: string) => {
    const code = await runDailyCommand(
      ['--date', date, '--create', '--workspace', rootDir],
      new TestLogger()
    );
    expect(exitCodeOf(code)).toBe(0);
  };

  it('links the previous daily note in journal/ from a template without a filepath', () =>
    withTmpWorkspace(
      {
        '.foam/templates/daily-note.md': 'Previous: [[${FOAM_PREVIOUS_DAILY_NOTE}]]\n',
        'journal/2026-10-06.md': '# 2026-10-06\n',
      },
      async ({ rootDir }) => {
        await createNote(rootDir, '2026-10-07');
        expect(
          fs.readFileSync(path.join(rootDir, 'journal', '2026-10-07.md'), 'utf8')
        ).toBe('Previous: [[2026-10-06]]\n');
      }
    ));

  it('links the previous daily note in the openDailyNote directory from a template without a filepath', () =>
    withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({
          'foam.openDailyNote.directory': 'diary',
        }),
        '.foam/templates/daily-note.md': 'Previous: [[${FOAM_PREVIOUS_DAILY_NOTE}]]\n',
        'diary/2026-10-06.md': '# 2026-10-06\n',
      },
      async ({ rootDir }) => {
        await createNote(rootDir, '2026-10-07');
        expect(
          fs.readFileSync(path.join(rootDir, 'diary', '2026-10-07.md'), 'utf8')
        ).toBe('Previous: [[2026-10-06]]\n');
      }
    ));

  it('resolves FOAM_TITLE in the template to the date', () =>
    withTmpWorkspace(
      { '.foam/templates/daily-note.md': '# ${FOAM_TITLE}\n' },
      async ({ rootDir }) => {
        await createNote(rootDir, '2026-10-07');
        expect(
          fs.readFileSync(path.join(rootDir, 'journal', '2026-10-07.md'), 'utf8')
        ).toBe('# 2026-10-07\n');
      }
    ));

  it('names months in the foam.dateLocale language', () =>
    withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({ 'foam.dateLocale': 'it-IT' }),
        '.foam/templates/daily-note.md': '${FOAM_DATE_MONTH_NAME}\n',
      },
      async ({ rootDir }) => {
        await createNote(rootDir, '2026-10-07');
        expect(
          fs.readFileSync(path.join(rootDir, 'journal', '2026-10-07.md'), 'utf8')
        ).toBe('ottobre\n');
      }
    ));

  it('titles a note without a template by openDailyNote.titleFormat', () =>
    withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({
          'foam.openDailyNote.titleFormat': 'fullDate',
        }),
      },
      async ({ rootDir }) => {
        await createNote(rootDir, '2026-10-07');
        expect(
          fs.readFileSync(path.join(rootDir, 'journal', '2026-10-07.md'), 'utf8')
        ).toBe('# Wednesday, October 7, 2026\n');
      }
    ));

  it('titles a note without a template by the filename format when no title format is set', () =>
    withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({
          'foam.openDailyNote.filenameFormat': 'dd-mm-yyyy',
        }),
      },
      async ({ rootDir }) => {
        await createNote(rootDir, '2026-10-07');
        expect(
          fs.readFileSync(path.join(rootDir, 'journal', '07-10-2026.md'), 'utf8')
        ).toBe('# 07-10-2026\n');
      }
    ));
});

describe('keeping the daily note inside the workspace', () => {
  // The escape target is named after the temp workspace, so a run that does
  // escape can't leave a folder that a later run would trip over.
  const escapeTarget = (rootDir: string) => `${path.basename(rootDir)}-escaped`;

  it('refuses an openDailyNote directory that leads out of the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      fs.mkdirSync(path.join(rootDir, '.vscode'));
      fs.writeFileSync(
        path.join(rootDir, '.vscode', 'settings.json'),
        JSON.stringify({
          'foam.openDailyNote.directory': `../${escapeTarget(rootDir)}`,
        })
      );

      await expect(
        runDailyCommand(['--date', '2026-05-01', '--create', '--workspace', rootDir], new TestLogger())
      ).rejects.toThrow('outside the workspace');
      expect(fs.existsSync(path.join(rootDir, '..', escapeTarget(rootDir)))).toBe(false);
    }));

  it('refuses a template filepath that leads out of the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      fs.mkdirSync(path.join(rootDir, '.foam', 'templates'), { recursive: true });
      fs.writeFileSync(
        path.join(rootDir, '.foam', 'templates', 'daily-note.md'),
        [
          '---',
          'foam_template:',
          `  filepath: "../${escapeTarget(rootDir)}/\${FOAM_DATE_YEAR}.md"`,
          '---',
          '# Day',
        ].join('\n')
      );

      await expect(
        runDailyCommand(['--date', '2026-05-01', '--create', '--workspace', rootDir], new TestLogger())
      ).rejects.toThrow(/outside the workspace.*Check foam\.openDailyNote\.directory and the daily note template's filepath/);
      expect(fs.existsSync(path.join(rootDir, '..', escapeTarget(rootDir)))).toBe(false);
    }));

  it('refuses a daily note folder that is a symlink out of the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const outside = path.join(rootDir, '..', escapeTarget(rootDir));
      fs.mkdirSync(outside);
      try {
        fs.symlinkSync(outside, path.join(rootDir, 'journal'));

        await expect(
          runDailyCommand(['--date', '2026-05-01', '--create', '--workspace', rootDir], new TestLogger())
        ).rejects.toThrow('outside the workspace');
        expect(fs.readdirSync(outside)).toEqual([]);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('refuses a daily note that is a dangling symlink out of the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const outside = path.join(rootDir, '..', escapeTarget(rootDir));
      fs.mkdirSync(outside);
      try {
        fs.mkdirSync(path.join(rootDir, 'journal'));
        fs.symlinkSync(
          path.join(outside, 'planted.md'),
          path.join(rootDir, 'journal', '2026-05-01.md')
        );

        await expect(
          runDailyCommand(['--date', '2026-05-01', '--create', '--workspace', rootDir], new TestLogger())
        ).rejects.toThrow('outside the workspace');
        expect(fs.readdirSync(outside)).toEqual([]);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('writes a template filepath through a symlink and .. where its path says, inside the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const outside = path.join(rootDir, '..', escapeTarget(rootDir));
      fs.mkdirSync(path.join(outside, 'inner'), { recursive: true });
      try {
        fs.mkdirSync(path.join(rootDir, 'journals'));
        fs.symlinkSync(path.join(outside, 'inner'), path.join(rootDir, 'journals', 'link'));
        fs.mkdirSync(path.join(rootDir, '.foam', 'templates'), { recursive: true });
        fs.writeFileSync(
          path.join(rootDir, '.foam', 'templates', 'daily-note.md'),
          [
            '---',
            'foam_template:',
            '  filepath: "journals/link/../planted.md"',
            '---',
            '# Day',
          ].join('\n')
        );

        const code = await runDailyCommand(
          ['--date', '2026-05-01', '--create', '--workspace', rootDir],
          new TestLogger()
        );

        expect(exitCodeOf(code)).toBe(0);
        expect(fs.existsSync(path.join(rootDir, 'journals', 'planted.md'))).toBe(true);
        expect(fs.readdirSync(outside)).toEqual(['inner']);
        expect(fs.readdirSync(path.join(outside, 'inner'))).toEqual([]);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('still creates the note through a symlink that stays inside the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      fs.mkdirSync(path.join(rootDir, 'diary'));
      fs.symlinkSync(path.join(rootDir, 'diary'), path.join(rootDir, 'journal'));

      const code = await runDailyCommand(
        ['--date', '2026-05-01', '--create', '--workspace', rootDir],
        new TestLogger()
      );

      expect(exitCodeOf(code)).toBe(0);
      expect(fs.existsSync(path.join(rootDir, 'diary', '2026-05-01.md'))).toBe(true);
    }));
});

// ─── JavaScript daily-note templates ──────────────────────────────────────────

describe('running a JavaScript daily-note template', () => {
  const jsTemplate = `
    async function createNote() {
      return { filepath: 'days/from-js.md', content: '# From JS\\n' };
    }
  `;

  it('refuses without --trust, with a hint, and writes nothing', () =>
    withTmpWorkspace(
      { '.foam/templates/daily-note.js': jsTemplate },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runDailyCommand(
          ['--date', '2026-05-01', '--create', '--workspace', rootDir],
          logger
        );

        expect(exitCodeOf(code)).toBe(1);
        expect(logger.errors.join('\n')).toContain(
          'Re-run with --trust if you authored the template yourself.'
        );
        expect(fs.existsSync(path.join(rootDir, 'days'))).toBe(false);
        expect(fs.existsSync(path.join(rootDir, 'journal'))).toBe(false);
      }
    ));

  it('creates the note where the template says, with its content, under --trust', () =>
    withTmpWorkspace(
      { '.foam/templates/daily-note.js': jsTemplate },
      async ({ rootDir }) => {
        const code = await runDailyCommand(
          [
            '--date',
            '2026-05-01',
            '--trust',
            '--create',
            '--workspace',
            rootDir,
          ],
          new TestLogger()
        );

        expect(exitCodeOf(code)).toBe(0);
        expect(
          fs.readFileSync(path.join(rootDir, 'days', 'from-js.md'), 'utf8')
        ).toBe('# From JS\n');
      }
    ));
});

// ─── runDailyCommand ──────────────────────────────────────────────────────────

describe('runDailyCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runDailyCommand(['--help'], logger);
    expect(exitCodeOf(code)).toBe(0);
    expect(logger.logs[0]).toContain('foam daily');
  });

  it('shows the resolved path and [does not exist] for a future date', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(['--date', '2099-12-31', '--workspace', rootDir], logger);
      expect(exitCodeOf(code)).toBe(0);
      expect(logger.logs[0]).toContain('2099-12-31.md');
      expect(logger.logs[0]).toContain('[does not exist]');
    }));

  it('shows [exists] when the daily note already exists', () =>
    withTmpWorkspace({ 'journal/2026-05-01.md': '# 2026-05-01\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(['--date', '2026-05-01', '--workspace', rootDir], logger);
      expect(exitCodeOf(code)).toBe(0);
      expect(logger.logs[0]).toContain('[exists]');
    }));

  it('--create creates the file when it does not exist', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(['--date', '2099-12-31', '--create', '--workspace', rootDir], logger);
      expect(exitCodeOf(code)).toBe(0);
      expect(fs.existsSync(path.join(rootDir, 'journal', '2099-12-31.md'))).toBe(true);
      expect(logger.logs[0]).toContain('2099-12-31');
    }));

  it('--path-only prints the bare path', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(['--date', '2099-12-31', '--path-only', '--workspace', rootDir], logger);
      expect(exitCodeOf(code)).toBe(0);
      expect(logger.logs[0]).toContain('2099-12-31.md');
      expect(logger.logs[0]).not.toContain('[');
    }));

  it('returns JSON with id, uri, exists', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(['--date', '2099-12-31', '--format', 'json', '--workspace', rootDir], logger);
      expect(exitCodeOf(code)).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('uri');
      expect(result).toHaveProperty('exists', false);
    }));

  it('uses a daily-note.md template when present and attaches template telemetry', () =>
    withTmpWorkspace(
      {
        '.foam/templates/daily-note.md': [
          '---',
          'foam_template:',
          '  filepath: "journals/$FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE.md"',
          '---',
          '',
          '# $FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE',
          '',
          '## Notes',
        ].join('\n'),
      },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runDailyCommand(['--date', '2099-12-31', '--create', '--workspace', rootDir], logger);
        expect(exitCodeOf(code)).toBe(0);
        const notePath = path.join(rootDir, 'journals', '2099-12-31.md');
        expect(fs.existsSync(notePath)).toBe(true);
        expect(fs.readFileSync(notePath, 'utf8')).toContain('## Notes');
        expect(telemetryOf(code)).toEqual({
          mode: 'create',
          'template-type': 'daily-note',
          'template-format': 'md',
        });
      }
    ));

  it('--create without a template emits mode=create but no template-* (fallback body)', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--create', '--workspace', rootDir],
        logger
      );
      expect(exitCodeOf(code)).toBe(0);
      // telemetry should not include template properties
      expect(telemetryOf(code)).toEqual({ mode: 'create' });
    }));

  it('without --create emits mode=open (read-only lookup, nothing written)', () =>
    withTmpWorkspace({}, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runDailyCommand(
        ['--date', '2099-12-31', '--workspace', rootDir],
        logger
      );
      expect(exitCodeOf(code)).toBe(0);
      expect(telemetryOf(code)).toEqual({ mode: 'open' });
    }));

  it('--create against an existing daily note emits mode=open (nothing was written this run)', () =>
    withTmpWorkspace(
      {
        'journals/2026-05-01.md': '# 2026-05-01\n',
        '.foam/templates/daily-note.md': [
          '---',
          'foam_template:',
          '  filepath: "journals/$FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE.md"',
          '---',
          '',
          '# from template',
        ].join('\n'),
      },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runDailyCommand(
          ['--date', '2026-05-01', '--create', '--workspace', rootDir],
          logger
        );
        expect(exitCodeOf(code)).toBe(0);
        // The note pre-existed, so --create was a no-op — `mode` reflects
        // what actually happened, not the user's intent.
        expect(telemetryOf(code)).toEqual({ mode: 'open' });
      }
    ));
});


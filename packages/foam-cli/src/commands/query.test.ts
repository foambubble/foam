import { describe, expect, it } from 'vitest';
import { runQueryCommand } from './query';
import { withTmpWorkspace, TestLogger } from '../test/test-utils';
import { setColorsEnabled } from '../support/colors';

setColorsEnabled(false);

const WIP_QUERY = `name: Work in Progress
description: Stuff I'm editing
filter: "#wip"
`;

const ARCHIVE_QUERY = `filter: "#archive"
`;

describe('runQueryCommand', () => {
  it('prints help with --help and a non-zero code when called without args', async () => {
    const logger = new TestLogger();
    const code = await runQueryCommand([], logger);
    expect(code).toBe(1);
    expect(logger.logs[0]).toContain('foam query');
  });

  it('prints help and returns 0 with --help', async () => {
    const logger = new TestLogger();
    const code = await runQueryCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam query');
  });

  it('errors on unknown subcommand', async () => {
    const logger = new TestLogger();
    const code = await runQueryCommand(['bogus'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('Unknown subcommand');
  });

  describe('list', () => {
    it('shows saved queries with match counts', () =>
      withTmpWorkspace(
        {
          'wip.md': '# Wip\n\n#wip',
          'done.md': '# Done\n\n#archive',
          '.foam/queries/wip.yaml': WIP_QUERY,
          '.foam/queries/archive.yaml': ARCHIVE_QUERY,
        },
        async ({ rootDir }) => {
          const logger = new TestLogger();
          const code = await runQueryCommand(
            ['list', '--workspace', rootDir],
            logger
          );
          expect(code).toBe(0);
          const out = logger.logs.join('\n');
          expect(out).toContain('wip');
          expect(out).toContain('archive');
          expect(out).toContain('Work in Progress');
          // Match counts shown in parens.
          expect(out).toMatch(/\(\d+\)/);
        }
      ));

    it('returns JSON when --format=json is passed', () =>
      withTmpWorkspace(
        {
          'wip.md': '# Wip\n\n#wip',
          '.foam/queries/wip.yaml': WIP_QUERY,
        },
        async ({ rootDir }) => {
          const logger = new TestLogger();
          const code = await runQueryCommand(
            ['list', '--workspace', rootDir, '--format=json'],
            logger
          );
          expect(code).toBe(0);
          const parsed = JSON.parse(logger.logs[0]);
          expect(parsed).toEqual([
            {
              id: 'wip',
              name: 'Work in Progress',
              description: "Stuff I'm editing",
              matchCount: 1,
              errors: [],
            },
          ]);
        }
      ));

    it('prints nothing when there are no saved queries', () =>
      withTmpWorkspace({ 'a.md': '# A' }, async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runQueryCommand(
          ['list', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(0);
        expect(logger.logs).toEqual([]);
      }));
  });

  describe('run', () => {
    it('returns matching note paths for a saved query', () =>
      withTmpWorkspace(
        {
          'wip.md': '# Wip\n\n#wip',
          'other.md': '# Other\n\n#other',
          '.foam/queries/wip.yaml': WIP_QUERY,
        },
        async ({ rootDir }) => {
          const logger = new TestLogger();
          const code = await runQueryCommand(
            ['run', 'wip', '--workspace', rootDir],
            logger
          );
          expect(code).toBe(0);
          expect(logger.logs[0]).toContain('wip.md');
          expect(logger.logs[0]).not.toContain('other.md');
        }
      ));

    it('errors when the saved query does not exist', () =>
      withTmpWorkspace({ 'a.md': '# A' }, async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runQueryCommand(
          ['run', 'nope', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(1);
        expect(logger.errors[0]).toContain('not found');
      }));

    it('errors on missing id', async () => {
      const logger = new TestLogger();
      const code = await runQueryCommand(['run'], logger);
      expect(code).toBe(1);
      expect(logger.errors[0]).toContain('Usage');
    });
  });

  describe('show', () => {
    it('prints the YAML body of a saved query', () =>
      withTmpWorkspace(
        {
          'a.md': '# A',
          '.foam/queries/wip.yaml': WIP_QUERY,
        },
        async ({ rootDir }) => {
          const logger = new TestLogger();
          const code = await runQueryCommand(
            ['show', 'wip', '--workspace', rootDir],
            logger
          );
          expect(code).toBe(0);
          expect(logger.logs[0]).toContain('name: Work in Progress');
          expect(logger.logs[0]).toContain('filter:');
        }
      ));

    it('errors when the saved query does not exist', () =>
      withTmpWorkspace({ 'a.md': '# A' }, async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runQueryCommand(
          ['show', 'nope', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(1);
        expect(logger.errors[0]).toContain('not found');
      }));
  });
});

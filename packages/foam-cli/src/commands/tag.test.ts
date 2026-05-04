import fs from 'node:fs';
import path from 'node:path';

import { withTmpWorkspace, TestLogger } from '../test/test-utils';
import {
  cleanTag,
  runTagCommand,
} from './tag';

// Helpers

describe('cleanTag', () => {
  it('removes a leading hash from tag input', () => {
    expect(cleanTag('#project')).toBe('project');
    expect(cleanTag('project')).toBe('project');
  });
});

// runTagCommand

describe('runTagCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runTagCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam tag');
  });

  it('errors for unknown subcommand', async () => {
    const logger = new TestLogger();
    const code = await runTagCommand(['bogus'], logger);
    expect(code).toBe(1);
    expect(logger.errors[0]).toContain('Unknown subcommand');
  });

  it('list: delegates to list tags', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n#project' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runTagCommand(['list', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('#project');
    }));

  it('rename: renames a tag and reports text output', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n#project' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runTagCommand(
        ['rename', 'project', 'work', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs[0]).toContain('#project');
      expect(logger.logs[0]).toContain('#work');
      expect(fs.readFileSync(path.join(rootDir, 'a.md'), 'utf8')).toContain('#work');
    }));

  it('search: delegates to search by tag', () =>
    withTmpWorkspace({ 'a.md': '# A\n\n#project', 'b.md': '# B\n\n#personal' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runTagCommand(
        ['search', '#project', '--workspace', rootDir],
        logger
      );
      expect(code).toBe(0);
      expect(logger.logs.join('\n')).toContain('a.md:1: # A');
      expect(logger.logs.join('\n')).not.toContain('b.md');
    }));
});

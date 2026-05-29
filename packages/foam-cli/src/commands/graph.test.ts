import { withTmpWorkspace, TestLogger } from '../test/test-utils';
import { runGraphCommand } from './graph';
import { setColorsEnabled } from '../support/colors';

setColorsEnabled(false);

describe('runGraphCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runGraphCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam graph');
  });

  it('emits nodes and links in d3-compatible shape', () =>
    withTmpWorkspace(
      { 'a.md': '# A\n\n[[b]]', 'b.md': '# B' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runGraphCommand(['--workspace', rootDir], logger);
        expect(code).toBe(0);

        const result = JSON.parse(logger.logs[0]);
        expect(Array.isArray(result.nodes)).toBe(true);
        expect(Array.isArray(result.links)).toBe(true);

        const ids = result.nodes.map((n: any) => n.id);
        // workspace-relative POSIX paths
        expect(ids).toEqual(expect.arrayContaining(['a.md', 'b.md']));

        const a = result.nodes.find((n: any) => n.id === 'a.md');
        expect(a.title).toBe('A');
        expect(a.type).toBe('note');
        expect(a).toHaveProperty('properties');
        expect(a).toHaveProperty('tags');

        expect(result.links).toEqual(
          expect.arrayContaining([{ source: 'a.md', target: 'b.md' }])
        );
      }
    ));

  it('excludes placeholders by default', () =>
    withTmpWorkspace(
      { 'a.md': '# A\n\n[[missing]]' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runGraphCommand(['--workspace', rootDir], logger);
        expect(code).toBe(0);

        const result = JSON.parse(logger.logs[0]);
        const types = result.nodes.map((n: any) => n.type);
        expect(types).not.toContain('placeholder');
        expect(result.links).toHaveLength(0);
      }
    ));

  it('includes placeholders with --include-placeholders', () =>
    withTmpWorkspace(
      { 'a.md': '# A\n\n[[missing]]' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runGraphCommand(
          ['--include-placeholders', '--workspace', rootDir],
          logger
        );
        expect(code).toBe(0);

        const result = JSON.parse(logger.logs[0]);
        const types = result.nodes.map((n: any) => n.type);
        expect(types).toContain('placeholder');
        expect(result.links).toHaveLength(1);
      }
    ));
});

import { createNoteFromMarkdown, createInMemoryWorkspace, TEST_WORKSPACE_ROOT, withTmpWorkspace, TestLogger } from '../test/test-utils';
import { outlineData, runOutlineCommand } from './outline';

const ROOT = TEST_WORKSPACE_ROOT;

// ─── outlineData ──────────────────────────────────────────────────────────────

describe('outlineData', () => {
  it('returns sections with label and level', () => {
    const note = createNoteFromMarkdown(
      '/workspace/a.md',
      '# Title\n\n## Section A\n\n### Subsection\n\n## Section B\n',
      ROOT
    );
    const ws = createInMemoryWorkspace([note]);
    const data = outlineData(ws, 'a', undefined);
    expect(data.id).toBe('a');
    const labels = data.sections.map(s => s.label);
    expect(labels).toContain('Title');
    expect(labels).toContain('Section A');
    expect(labels).toContain('Subsection');
    expect(labels).toContain('Section B');
    expect(data.sections.find(s => s.label === 'Title')?.level).toBe(1);
    expect(data.sections.find(s => s.label === 'Section A')?.level).toBe(2);
    expect(data.sections.find(s => s.label === 'Subsection')?.level).toBe(3);
  });

  it('returns empty sections for a note with no headings', () => {
    const note = createNoteFromMarkdown('/workspace/b.md', 'Just text\n', ROOT);
    const ws = createInMemoryWorkspace([note]);
    const data = outlineData(ws, 'b', undefined);
    expect(data.sections).toHaveLength(0);
  });
});

// ─── runOutlineCommand ────────────────────────────────────────────────────────

describe('runOutlineCommand', () => {
  it('prints help with --help', async () => {
    const logger = new TestLogger();
    const code = await runOutlineCommand(['--help'], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam outline');
  });

  it('shows help when no args given', async () => {
    const logger = new TestLogger();
    const code = await runOutlineCommand([], logger);
    expect(code).toBe(0);
    expect(logger.logs[0]).toContain('foam outline');
  });

  it('prints outline as text with correct indentation', () =>
    withTmpWorkspace(
      { 'a.md': '# Title\n\n## Goals\n\n### Phase 1\n\n## References\n' },
      async ({ rootDir }) => {
        const logger = new TestLogger();
        const code = await runOutlineCommand(['a', '--workspace', rootDir], logger);
        expect(code).toBe(0);
        const lines = logger.logs.join('\n').split('\n');
        expect(lines[0]).toBe('# Title');
        expect(lines[1]).toBe('  ## Goals');
        expect(lines[2]).toBe('    ### Phase 1');
        expect(lines[3]).toBe('  ## References');
      }
    ));

  it('returns JSON with id, uri, sections', () =>
    withTmpWorkspace({ 'a.md': '# Title\n\n## Goals\n' }, async ({ rootDir }) => {
      const logger = new TestLogger();
      const code = await runOutlineCommand(['a', '--format', 'json', '--workspace', rootDir], logger);
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'a');
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.sections[0]).toHaveProperty('label');
      expect(result.sections[0]).toHaveProperty('level');
      expect(result.sections[0]).toHaveProperty('range');
    }));
});

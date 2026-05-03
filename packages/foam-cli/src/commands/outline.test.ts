import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FoamWorkspace, URI } from '@foam/core';
import { createNoteFromMarkdown, createTestWorkspace, TestLogger } from '../test/test-utils';
import { outlineData, runOutlineCommand } from './outline';

const ROOT = URI.file('/workspace');

function makeWorkspace(
  notes: ReturnType<typeof createNoteFromMarkdown>[]
): FoamWorkspace {
  const ws = createTestWorkspace([ROOT]);
  for (const note of notes) ws.set(note);
  return ws;
}

// ─── outlineData ──────────────────────────────────────────────────────────────

describe('outlineData', () => {
  it('returns sections with label and level', () => {
    const note = createNoteFromMarkdown(
      '/workspace/a.md',
      '# Title\n\n## Section A\n\n### Subsection\n\n## Section B\n',
      ROOT
    );
    const ws = makeWorkspace([note]);
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
    const ws = makeWorkspace([note]);
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

  it('prints outline as text', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-outline-test-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'a.md'),
        '# Title\n\n## Goals\n\n### Phase 1\n\n## References\n',
        'utf8'
      );
      const logger = new TestLogger();
      const code = await runOutlineCommand(['a', '--workspace', tempDir], logger);
      expect(code).toBe(0);
      const out = logger.logs.join('\n');
      expect(out).toContain('Title');
      expect(out).toContain('Goals');
      expect(out).toContain('Phase 1');
      expect(out).toContain('References');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns JSON with id, uri, sections', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-outline-test-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'a.md'),
        '# Title\n\n## Goals\n',
        'utf8'
      );
      const logger = new TestLogger();
      const code = await runOutlineCommand(
        ['a', '--format', 'json', '--workspace', tempDir],
        logger
      );
      expect(code).toBe(0);
      const result = JSON.parse(logger.logs[0]);
      expect(result).toHaveProperty('id', 'a');
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.sections[0]).toHaveProperty('label');
      expect(result.sections[0]).toHaveProperty('level');
      expect(result.sections[0]).toHaveProperty('range');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

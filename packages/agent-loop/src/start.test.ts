import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSpec } from './start.ts';

function rootWith(...specDirs: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-loop-start-'));
  for (const dir of specDirs) {
    mkdirSync(path.join(root, dir), { recursive: true });
    writeFileSync(path.join(root, dir, 'spec.md'), '# spec\n');
  }
  return root;
}

describe('findSpec', () => {
  it('finds the spec under specs/ named after the branch minus its prefix', () => {
    const root = rootWith('specs/1706-daily-note');
    expect(findSpec(root, 'feature/1706-daily-note')).toEqual({
      slug: '1706-daily-note',
      specDir: 'specs/1706-daily-note',
    });
  });

  it('finds a spec under specs.local/', () => {
    const root = rootWith('specs.local/agent-loop');
    expect(findSpec(root, 'feature/agent-loop').specDir).toBe('specs.local/agent-loop');
  });

  it('prefers the tracked spec when both exist', () => {
    const root = rootWith('specs/agent-loop', 'specs.local/agent-loop');
    expect(findSpec(root, 'feature/agent-loop').specDir).toBe('specs/agent-loop');
  });

  it('refuses the default branch, saying where it looked and naming /write-spec', () => {
    const root = rootWith('specs/other');
    expect(() => findSpec(root, 'main')).toThrow(/specs\/main\/spec\.md.*specs\.local\/main\/spec\.md[\s\S]*\/write-spec/);
  });

  it('refuses a branch with no spec', () => {
    const root = rootWith();
    expect(() => findSpec(root, 'claude/some-fix')).toThrow(/no spec[\s\S]*\/write-spec/);
  });
});

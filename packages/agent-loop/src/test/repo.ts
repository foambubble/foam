import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

export interface TestRepo {
  root: string;
  slug: string;
  specDir: string;
  head(): string;
  commit(file: string, content: string): string;
}

/** A git repository in a temp directory, on `feature/<slug>`, with a committed spec. */
export function makeRepo({ slug = 'demo', plan = false } = {}): TestRepo {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-loop-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'commit.gpgsign', 'false');
  writeFileSync(path.join(root, 'README.md'), 'test repo\n');
  writeFileSync(path.join(root, '.gitignore'), '.agent-loop\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'initial');
  git(root, 'switch', '-q', '-c', `feature/${slug}`);

  const specDir = `specs/${slug}`;
  mkdirSync(path.join(root, specDir), { recursive: true });
  writeFileSync(path.join(root, specDir, 'spec.md'), '# Demo\n\n- **AC-1**: it works.\n');
  if (plan) writeFileSync(path.join(root, specDir, 'plan.md'), '# Plan\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'spec');

  let counter = 0;
  return {
    root,
    slug,
    specDir,
    head: () => git(root, 'rev-parse', 'HEAD'),
    commit(file, content) {
      counter += 1;
      writeFileSync(path.join(root, file), content);
      git(root, 'add', file);
      git(root, 'commit', '-q', '-m', `change ${counter}`);
      return git(root, 'rev-parse', 'HEAD');
    },
  };
}

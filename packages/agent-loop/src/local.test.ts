import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runLocal } from './local.ts';
import { git, makeRepo } from './test/repo.ts';
import { clean, done, PASS, scripted } from './test/sessions.ts';

function output() {
  const stream = new PassThrough();
  let text = '';
  stream.on('data', chunk => (text += chunk));
  return { stream, text: () => text };
}

describe('runLocal', () => {
  it('leaves the commits on the local branch, pushes nothing and prints the summary', async () => {
    const repo = makeRepo();
    const remote = mkdtempSync(path.join(tmpdir(), 'agent-loop-remote-'));
    git(remote, 'init', '-q', '--bare');
    git(repo.root, 'remote', 'add', 'origin', remote);
    git(repo.root, 'push', '-q', 'origin', 'feature/demo');
    const pushed = git(remote, 'rev-parse', 'feature/demo');
    const out = output();

    const result = await runLocal({
      root: repo.root,
      branch: 'feature/demo',
      rounds: 3,
      gate: [PASS],
      input: new PassThrough(),
      output: out.stream,
      sessions: {
        coder: scripted(() => (repo.commit('a.txt', 'a'), done())),
        reviewer: scripted(() => clean),
        cold: scripted(() => clean),
      },
    });

    expect(git(remote, 'rev-parse', 'feature/demo')).toBe(pushed);
    expect(repo.head()).not.toBe(pushed);
    expect(out.text()).toContain('### Implement and review loop');
    expect(out.text()).toContain('Nothing was pushed or posted');
    expect(result.rounds).toBe(1);
  });

  it('starts no session on a branch without a spec', async () => {
    const repo = makeRepo();
    git(repo.root, 'switch', '-q', 'main');
    const coder = scripted();
    const run = runLocal({
      root: repo.root,
      branch: 'main',
      rounds: 3,
      gate: [PASS],
      input: new PassThrough(),
      output: output().stream,
      sessions: { coder, reviewer: scripted(), cold: scripted() },
    });
    await expect(run).rejects.toThrow(/\/write-spec/);
    expect(coder.calls).toBe(0);
  });
});

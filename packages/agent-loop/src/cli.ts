import { spawnSync } from 'node:child_process';
import { runLocal, GATE } from './local.ts';
import { LoopError } from './loop.ts';
import { sdkSessions } from './sessions.ts';
import { StartError } from './start.ts';

const USAGE = 'usage: yarn agent-loop [--rounds N] ["instructions"]';

function fail(message: string): never {
  process.stderr.write(`agent-loop: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): { rounds: number; instructions?: string } {
  let rounds = 3;
  const words: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--rounds') rounds = Number(argv[++i]);
    else if (argv[i].startsWith('--')) fail(`unknown option ${argv[i]}\n${USAGE}`);
    else words.push(argv[i]);
  }
  if (!Number.isInteger(rounds) || rounds < 1) fail(`--rounds takes a whole number of at least 1\n${USAGE}`);
  return { rounds, instructions: words.length > 0 ? words.join(' ') : undefined };
}

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

const args = parseArgs(process.argv.slice(2));
// Under `yarn agent-loop` the process starts in this package; INIT_CWD is where yarn was run.
const root = git(process.env.INIT_CWD ?? process.cwd(), 'rev-parse', '--show-toplevel');
const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');

// Leaked by editor terminals; it makes the VS Code test host start as plain Node.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

try {
  await runLocal({
    root,
    branch,
    ...args,
    sessions: sdkSessions({ cwd: root, env }),
    gate: GATE,
    env,
    input: process.stdin,
    output: process.stdout,
  });
  process.exit(0);
} catch (error) {
  if (error instanceof StartError || error instanceof LoopError) fail(error.message);
  throw error;
}

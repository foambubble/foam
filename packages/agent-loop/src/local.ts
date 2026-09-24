import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { type LoopResult, runLoop, type Sessions } from './loop.ts';
import { render } from './render.ts';
import { findSpec } from './start.ts';
import { terminalFeedback } from './terminal.ts';

/** What stands between a coder round and a review, in the order CI runs it. */
export const GATE = ['yarn build', 'yarn lint', 'yarn test'];

export interface LocalOptions {
  root: string;
  branch: string;
  instructions?: string;
  rounds: number;
  sessions: Sessions;
  gate: string[];
  env?: NodeJS.ProcessEnv;
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  now?: () => Date;
}

/**
 * The loop as run from a terminal: feedback is typed while it runs, the
 * summary is printed, and nothing leaves the machine.
 */
export async function runLocal(options: LocalOptions): Promise<LoopResult> {
  const { root, branch, output } = options;
  const { slug, specDir } = findSpec(root, branch);
  const print = (line: string) => output.write(`${line}\n`);

  print(`agent-loop: ${branch} → ${specDir}, up to ${options.rounds} rounds`);
  print(`Type feedback at any time and press Enter: it joins the next round.`);

  const feedback = terminalFeedback(options.input);
  try {
    const result = await runLoop({ ...options, slug, specDir, feedback, progress: print });
    const summary = render(result);
    writeFileSync(path.join(result.runDir, 'summary.md'), `${summary}\n`);
    print('');
    print(summary);
    print('');
    print(
      `Nothing was pushed or posted. The commits are on ${branch}; the run record is in ${path.relative(root, result.runDir)}.`
    );
    return result;
  } finally {
    feedback.close();
  }
}

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { coderFirstBrief, coderNextBrief, coldBrief, reviewerBrief } from './briefs.ts';
import { BLOCKING_TIER, CoderResultSchema, ReviewSchema, type Review, type Tier } from './contracts.ts';
import { runGate } from './gate.ts';

export type Source = 'reviewer' | 'suite' | 'maintainer' | 'cold';

export interface Finding {
  id: string;
  source: Source;
  round: number;
  tier?: Tier;
  path?: string;
  line?: number | null;
  finding: string;
  /** Shown to the coder, left out of the summary. */
  detail?: string;
}

export interface Outcome {
  outcome: 'fixed' | 'rejected';
  reason: string;
}

export interface SessionContext {
  label: string;
  /** One line of progress, kept in the run record and shown in the terminal. */
  log(line: string): void;
}

/** A session's structured output is returned unvalidated; the loop owns validation. */
export type Session = (brief: string, context: SessionContext) => Promise<{ output: unknown; costUsd: number }>;

export interface Sessions {
  coder: Session;
  reviewer: Session;
  cold: Session;
}

/** Messages from the maintainer. `take` returns what arrived since the last call. */
export interface Feedback {
  take(): string[];
}

export interface LoopOptions {
  /** Repository root: where sessions work, the gate runs, and the run record lives. */
  root: string;
  slug: string;
  /** Relative to root. */
  specDir: string;
  instructions?: string;
  rounds: number;
  sessions: Sessions;
  feedback: Feedback;
  /** Shell commands run after every coder round; the first failure ends the gate. */
  gate: string[];
  env?: NodeJS.ProcessEnv;
  progress?: (line: string) => void;
  now?: () => Date;
}

export interface LoopResult {
  runDir: string;
  rounds: number;
  stopped: string;
  blocked: boolean;
  /** Every finding the loop received, answered or not, in the order it arrived. */
  findings: Finding[];
  outcomes: Record<string, Outcome>;
  /** Null when no cold pass ran. */
  cold: Finding[] | null;
  costUsd: number;
}

export class LoopError extends Error {}

const ID_PREFIX: Record<Source, string> = { reviewer: 'R', suite: 'S', maintainer: 'M', cold: 'C' };
const GATE_TAIL_LINES = 80;

function git(root: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new LoopError(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export async function runLoop(options: LoopOptions): Promise<LoopResult> {
  const { root, slug, specDir, instructions, rounds, sessions, feedback, gate, env } = options;
  const progress = options.progress ?? (() => {});
  const now = options.now ?? (() => new Date());
  const planPath = `${specDir}/plan.md`;
  const planFile = existsSync(path.join(root, planPath)) ? planPath : null;

  const runDir = path.join(root, '.agent-loop', slug, now().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(path.dirname(runDir), { recursive: true });
  // Not recursive: a run that finds its directory taken fails rather than share it.
  mkdirSync(runDir);

  const findings: Finding[] = [];
  const outcomes: Record<string, Outcome> = {};
  const counters: Record<Source, number> = { reviewer: 0, suite: 0, maintainer: 0, cold: 0 };
  let costUsd = 0;

  const make = (source: Source, round: number, fields: Omit<Finding, 'id' | 'source' | 'round'>): Finding => {
    counters[source] += 1;
    return { id: `${ID_PREFIX[source]}${counters[source]}`, source, round, ...fields };
  };
  const add = (source: Source, round: number, fields: Omit<Finding, 'id' | 'source' | 'round'>): Finding => {
    const finding = make(source, round, fields);
    findings.push(finding);
    return finding;
  };
  const fromFeedback = (round: number) => feedback.take().map(text => add('maintainer', round, { finding: text }));
  const fromReview = (source: Source, round: number, review: Review) =>
    review.findings.map(({ tier, path: file, line, finding }) => make(source, round, { tier, path: file, line, finding }));

  async function call<T>(session: Session, schema: z.ZodType<T>, brief: string, label: string, dir: string, name: string) {
    writeFileSync(path.join(dir, `${name}-brief.md`), `${brief}\n`);
    const logFile = path.join(dir, `${name}.log`);
    progress(`── ${label}`);
    let result: Awaited<ReturnType<Session>>;
    try {
      result = await session(brief, {
        label,
        log(line) {
          appendFileSync(logFile, `${line}\n`);
          progress(`   ${line}`);
        },
      });
    } catch (error) {
      throw new LoopError(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    costUsd += result.costUsd;
    const parsed = schema.safeParse(result.output);
    if (!parsed.success) {
      throw new LoopError(`${label} returned output that does not match its contract:\n${z.prettifyError(parsed.error)}`);
    }
    writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(parsed.data, null, 2)}\n`);
    return parsed.data;
  }

  let pending = fromFeedback(1);
  let lastReview: Finding[] = [];
  let stopped = '';
  let blocked = false;
  let round = 0;

  while (!stopped) {
    round += 1;
    const dir = path.join(runDir, `round-${round}`);
    mkdirSync(dir);
    const head = git(root, 'rev-parse', 'HEAD');

    const brief =
      round === 1
        ? coderFirstBrief({ rounds, instructions, findings: pending, specDir, planFile })
        : coderNextBrief({ round, rounds, findings: pending, specDir, planFile });
    const coder = await call(sessions.coder, CoderResultSchema, brief, `round ${round} coder`, dir, 'coder');
    for (const { id, outcome, reason } of coder.outcomes) {
      if (findings.some(f => f.id === id)) outcomes[id] = { outcome, reason };
    }

    if (coder.blocked) {
      blocked = true;
      stopped = `blocked: ${coder.summary}`;
      break;
    }
    if (git(root, 'rev-parse', 'HEAD') === head) {
      stopped = 'no commit this round';
      break;
    }

    progress(`── round ${round} gate: ${gate.join(', ')}`);
    const gateResult = runGate(gate, { cwd: root, env });
    const gateLog = path.join(dir, 'gate.log');
    writeFileSync(gateLog, gateResult.log);

    if (!gateResult.ok) {
      progress(`   ${gateResult.command} failed; back to the coder without a review`);
      const tail = gateResult.output.trimEnd().split('\n').slice(-GATE_TAIL_LINES).join('\n');
      const failure = add('suite', round, {
        finding: `\`${gateResult.command}\` failed`,
        detail: `Last lines of its output:\n\n${tail}\n\nFull output: ${path.relative(root, gateLog)}`,
      });
      pending = [failure, ...fromFeedback(round)];
    } else {
      progress('   green');
      const previous = lastReview.map(f => ({ ...f, outcome: outcomes[f.id] }));
      const review = await call(
        sessions.reviewer,
        ReviewSchema,
        reviewerBrief({ round, specDir, previous }),
        `round ${round} reviewer`,
        dir,
        'reviewer'
      );
      lastReview = fromReview('reviewer', round, review);
      findings.push(...lastReview);
      const blocking = lastReview.filter(f => f.tier === BLOCKING_TIER);
      progress(`   ${lastReview.length} findings, ${blocking.length} ${BLOCKING_TIER}`);

      const waiting = fromFeedback(round);
      if (blocking.length === 0 && waiting.length === 0) {
        stopped = `no ${BLOCKING_TIER} findings left`;
        break;
      }
      pending = [...lastReview, ...waiting];
    }

    if (round >= rounds) stopped = `round cap reached (${rounds})`;
  }

  let cold: Finding[] | null = null;
  if (!blocked) {
    const dir = path.join(runDir, 'cold');
    mkdirSync(dir);
    const review = await call(sessions.cold, ReviewSchema, coldBrief({ specDir }), 'cold pass', dir, 'cold');
    cold = fromReview('cold', round, review);
  }

  // Anything typed after the last take is still the maintainer's, and shows as open.
  fromFeedback(round);

  return { runDir, rounds: round, stopped, blocked, findings, outcomes, cold, costUsd };
}

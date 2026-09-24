import type { Feedback, Session, SessionContext } from '../loop.ts';

type Step = (brief: string, context: SessionContext) => unknown;

export interface ScriptedSession extends Session {
  briefs: string[];
  calls: number;
}

/** A session that answers each call with the next step's return value. */
export function scripted(...steps: Step[]): ScriptedSession {
  const briefs: string[] = [];
  const session = (async (brief: string, context: SessionContext) => {
    const step = steps[briefs.length];
    briefs.push(brief);
    if (!step) throw new Error(`${context.label}: no scripted step for call ${briefs.length}`);
    return { output: await step(brief, context), costUsd: 0.01 };
  }) as ScriptedSession;
  Object.defineProperty(session, 'briefs', { get: () => briefs });
  Object.defineProperty(session, 'calls', { get: () => briefs.length });
  return session;
}

export const clean = { findings: [] };

export function mustFix(finding: string) {
  return { findings: [{ path: 'src/a.ts', line: 1, tier: 'MUST_FIX', finding }] };
}

export function done(outcomes: { id: string; outcome: 'fixed' | 'rejected'; reason: string }[] = []) {
  return { blocked: false, summary: 'done', outcomes };
}

export interface TestQueue extends Feedback {
  push(message: string): void;
}

export function queue(...initial: string[]): TestQueue {
  const waiting = [...initial];
  return {
    push: message => void waiting.push(message),
    take: () => waiting.splice(0),
  };
}

export const PASS = 'node -e ""';
export const FAIL = `node -e "console.log('suite exploded'); process.exit(1)"`;

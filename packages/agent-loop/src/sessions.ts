import { type HookCallback, type Options, query, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { CoderResultSchema, ReviewSchema } from './contracts.ts';
import type { Session, Sessions } from './loop.ts';

const CODER_MODEL = 'claude-opus-5';
const REVIEWER_MODEL = 'claude-fable-5-1';
const CODER_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
const REVIEWER_TOOLS = ['Read', 'Glob', 'Grep', 'Bash'];

/** Read deny rules also cover Grep and Glob, which the hook can't see into. */
const REVIEWER_DENY = ['Read(./specs/**/plan.md)', 'Read(./.agent-loop/**)'];

type Refusal = (tool: string, input: unknown) => string | null;

const PLAN_REFUSED =
  'specs/**/plan.md is off limits to the reviewer: knowing the intended approach turns a review into a check against the plan';

const RECORD_REFUSED = ".agent-loop/ is the loop's record of earlier rounds; a reviewer reads the change, not its history";

/** The one exclusion pathspec that keeps every plan out of a patch. */
const PLAN_EXCLUSION = /(['"]?):(?:!|\(exclude\))specs\/\*\*\/plan\.md\1/g;

function commandOf(input: unknown): string {
  return String((input as { command?: unknown } | null)?.command ?? '');
}

/**
 * Whether a git command names only paths that cannot hold a plan: pathspecs
 * after `--` outside specs/, with no wildcard or magic, or blobs by `rev:path`.
 */
function limitedAwayFromPlans(command: string): boolean {
  const tokens = command.split(/\s+/).map(token => token.replace(/^['"]|['"]$/g, ''));
  const separator = tokens.indexOf('--');
  if (separator >= 0) {
    const paths = tokens.slice(separator + 1).filter(Boolean);
    return (
      paths.length > 0 &&
      paths.every(p => !/^(\.\/?|\/|specs\b.*|:.*)$/.test(p) && !/[*?[]|\.\./.test(p))
    );
  }
  const revisions = tokens.slice(2).filter(token => !token.startsWith('-'));
  return revisions.length > 0 && revisions.every(token => /^[^:]+:[^:]+$/.test(token));
}

/** Why the reviewer may not make this tool call, or null when it may. */
export const reviewerRefusal: Refusal = (tool, input) => {
  if (JSON.stringify(input ?? {}).includes('.agent-loop')) return RECORD_REFUSED;
  if (tool !== 'Bash') return JSON.stringify(input ?? {}).includes('plan.md') ? PLAN_REFUSED : null;

  const command = commandOf(input).trim();
  if (/[;`>]|&&|\|\||\$\(|--output/.test(command)) {
    return 'one read-only command: no chaining, substitution or redirection';
  }
  const [first, ...filters] = command.split('|').map(segment => segment.trim());
  if (!/^git\s+(diff|log|show|status|blame)\b/.test(first)) {
    return 'Bash is limited to git diff, git log, git show, git status and git blame';
  }
  if (filters.some(f => !/^(head|tail|wc|grep|sort|uniq|cut)\b/.test(f) || /\s(-r|-R|--recursive)\b/.test(f))) {
    return 'pipe only into head, tail, wc, grep, sort, uniq or cut, reading from the pipe';
  }

  const unexcluded = command.replace(PLAN_EXCLUSION, '');
  if (unexcluded.includes('plan.md')) return PLAN_REFUSED;
  const patch = /^git\s+(diff|show)\b/.test(first) || /^git\s+log\b.*\s(-p|--patch|-u)\b/.test(first);
  const summaryOnly = /\s--(stat|shortstat|numstat|name-only|name-status)\b/.test(first);
  if (patch && !summaryOnly && unexcluded === command && !limitedAwayFromPlans(first)) {
    return `add -- . ':!specs/**/plan.md' so no plan appears in the output`;
  }
  return null;
};

/** Each program a shell command runs, with its arguments, quoted text removed. */
function programs(command: string): string[][] {
  return command
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""')
    .split(/;|&&|\|\||\||\$\(|`/)
    .map(segment => segment.trim().split(/\s+/))
    .filter(tokens => tokens[0]);
}

function gitSubcommand(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '-C' || args[i] === '-c') i += 1;
    else if (!args[i].startsWith('-')) return args[i];
  }
  return undefined;
}

/** Why the coder may not make this tool call, or null when it may. */
export const coderRefusal: Refusal = (tool, input) => {
  if (tool !== 'Bash') return null;
  for (const [program, ...args] of programs(commandOf(input))) {
    if (program === 'git' && gitSubcommand(args) === 'push') return 'pushing belongs to the loop, not the coder';
    if (program === 'gh') return 'GitHub is out of reach during a local run';
  }
  return null;
};

function preToolUse(refuse: Refusal, log: (line: string) => void): HookCallback {
  return async input => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    const reason = refuse(input.tool_name, input.tool_input);
    if (!reason) return {};
    log(`refused ${input.tool_name}: ${reason}`);
    return {
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    };
  };
}

/**
 * A session's output and cost from its result message. A result flagged as an
 * error fails even when its subtype says success: that is how the SDK reports
 * a session that never started, such as one that could not authenticate.
 */
export function readResult(message: SDKResultMessage): { output: unknown; costUsd: number } {
  if (message.subtype !== 'success') {
    throw new Error(`${message.subtype} after ${message.num_turns} turns: ${message.errors.join('; ')}`);
  }
  if (message.is_error) throw new Error(message.result);
  return { output: message.structured_output, costUsd: message.total_cost_usd };
}

/** The Claude Code process validates output schemas as draft-07; zod defaults to 2020-12. */
export function outputSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
}

function describe(name: string, input: Record<string, unknown>): string {
  const detail = input.command ?? input.file_path ?? input.pattern ?? '';
  const line = String(detail).split('\n')[0];
  return `${name} ${line.length > 120 ? `${line.slice(0, 117)}...` : line}`.trim();
}

interface SessionSpec {
  model: string;
  tools: string[];
  schema: z.ZodType;
  refuse: Refusal;
  deny?: string[];
}

function sdkSession({ cwd, env }: { cwd: string; env: NodeJS.ProcessEnv }, spec: SessionSpec): Session {
  return async (brief, { log }) => {
    const options: Options = {
      cwd,
      env,
      model: spec.model,
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      settingSources: ['project'],
      tools: spec.tools,
      allowedTools: spec.tools,
      permissionMode: 'dontAsk',
      ...(spec.deny ? { settings: { permissions: { deny: spec.deny } } } : {}),
      hooks: { PreToolUse: [{ hooks: [preToolUse(spec.refuse, log)] }] },
      outputFormat: { type: 'json_schema', schema: outputSchema(spec.schema) },
    };

    for await (const message of query({ prompt: brief, options })) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') log(describe(block.name, block.input as Record<string, unknown>));
        }
      }
      if (message.type !== 'result') continue;
      log(`${message.num_turns} turns, $${message.total_cost_usd.toFixed(2)}`);
      return readResult(message);
    }
    throw new Error('the session ended without a result');
  };
}

/** Coder, reviewer and cold reviewer as Agent SDK sessions working in `cwd`. */
export function sdkSessions(context: { cwd: string; env: NodeJS.ProcessEnv }): Sessions {
  const reviewer: SessionSpec = {
    model: REVIEWER_MODEL,
    tools: REVIEWER_TOOLS,
    schema: ReviewSchema,
    refuse: reviewerRefusal,
    deny: REVIEWER_DENY,
  };
  return {
    coder: sdkSession(context, { model: CODER_MODEL, tools: CODER_TOOLS, schema: CoderResultSchema, refuse: coderRefusal }),
    reviewer: sdkSession(context, reviewer),
    cold: sdkSession(context, reviewer),
  };
}

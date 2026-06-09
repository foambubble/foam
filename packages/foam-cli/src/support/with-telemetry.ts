import { ITelemetryReporter, bucketDuration } from '@foam/core';

/**
 * Commands the dispatcher recognizes. The single source of truth — both
 * the dispatch switch and the telemetry skip check read from here, so a
 * new command added to the switch must also be added here.
 *
 * Anything *not* in this set is treated as an unknown command: the
 * dispatcher prints an error, and telemetry doesn't fire (because the
 * "command word" would otherwise be a user-supplied free-text string).
 */
export const KNOWN_COMMANDS = new Set([
  'publish',
  'lint',
  'list',
  'note',
  'outline',
  'links',
  'connections',
  'graph',
  'daily',
  'tag',
  'grep',
  'search',
  'rename',
  'update',
  'mcp',
  'config',
]);

/**
 * Commands that, while recognized, opt out of telemetry entirely —
 * including the first-run consent prompt. `config` lets users set their
 * preference without being nagged; the help/version aliases are
 * non-actions and shouldn't count as command invocations.
 */
const TELEMETRY_SKIP_COMMANDS = new Set([
  'config',
  'help',
  '--help',
  '-h',
  '--version',
  '-v',
]);

/**
 * Decides whether this invocation should bypass telemetry entirely
 * (no consent prompt, no `cli.command-invoked` event). True for:
 *
 *  - no command at all (bare `foam`)
 *  - `config`, `help`, `--help`, `-h`, `--version`, `-v`
 *  - any unknown command — the word would be an unbounded free-text
 *    string, and a new user typing a typo first shouldn't see a
 *    consent prompt
 *  - any invocation with `--help` or `-h` anywhere in the args
 *    (e.g. `foam publish --help`) — these don't run the command
 */
export function shouldSkipTelemetry(
  command: string | undefined,
  commandArgs: readonly string[] = []
): boolean {
  if (command === undefined) return true;
  if (TELEMETRY_SKIP_COMMANDS.has(command)) return true;
  if (!KNOWN_COMMANDS.has(command)) return true;
  if (commandArgs.includes('--help') || commandArgs.includes('-h')) return true;
  return false;
}

/**
 * Return shape of a command run by the dispatcher. Either a bare exit code
 * (the common case) or an object carrying both the exit code and extra
 * per-command properties to attach to `cli.command-invoked`.
 *
 * Property values must be enum-shaped / bounded — never user-defined strings.
 */
export type CommandRunResult =
  | number
  | { exitCode: number; telemetryProperties?: Record<string, string> };

export interface WithTelemetryOptions {
  command: string;
  /**
   * Reporter the command should use for `cli.*` events. Already resolved by
   * the caller (consent + identity baked in) — this wrapper does not touch
   * consent. Pass `NoopTelemetryReporter` when telemetry should be off.
   */
  reporter: ITelemetryReporter;
  run: (reporter: ITelemetryReporter) => Promise<CommandRunResult>;
}

/**
 * Wraps a command run with the lifecycle telemetry: measures duration,
 * captures the exit code, and emits `cli.command-invoked` on completion.
 *
 * Consent and reporter selection are not this wrapper's concern — the
 * caller has already decided whether `reporter` is a real one or
 * `NoopTelemetryReporter`. See `resolveCliReporter` for that.
 */
export async function withTelemetry(opts: WithTelemetryOptions): Promise<number> {
  const { reporter } = opts;
  const startedAt = Date.now();
  let exitCode = 1;
  let extraProps: Record<string, string> | undefined;
  try {
    const result = await opts.run(reporter);
    if (typeof result === 'number') {
      exitCode = result;
    } else {
      exitCode = result.exitCode;
      extraProps = result.telemetryProperties;
    }
  } finally {
    const durationBucket = bucketDuration(Date.now() - startedAt);
    reporter.trackEvent('cli.command-invoked', {
      command: opts.command,
      durationBucket,
      exitCode: String(exitCode),
      ...extraProps,
    });
    await reporter.dispose();
  }
  return exitCode;
}

import { ITelemetryReporter, bucketDuration } from '@foam/core';

const TELEMETRY_SKIP_COMMANDS = new Set(['config']);

export function shouldSkipTelemetry(command: string | undefined): boolean {
  return command === undefined || TELEMETRY_SKIP_COMMANDS.has(command);
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
 * Also reports thrown errors via `trackError` before re-raising.
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
  } catch (e) {
    reporter.trackError('dispatch', e, { command: opts.command });
    throw e;
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

import {
  ConsentInput,
  ITelemetryReporter,
  NoopTelemetryReporter,
  bucketDuration,
  decideConsent,
} from '@foam/core';
import { promptFirstRunConsent } from './first-run';
import { State } from './state';
import {
  readEnvConfigSource,
  readRawUserConfig,
  writeRawUserConfig,
} from './user-config';

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
   * Reporter the command should use for `cli.*` events. `withTelemetry`
   * may substitute `NoopTelemetryReporter` if the user has opted out —
   * the `run` callback always receives the *effective* reporter.
   */
  reporter: ITelemetryReporter;
  run: (reporter: ITelemetryReporter) => Promise<CommandRunResult>;
  /** For tests: replaces the first-run prompt. */
  promptOverride?: () => Promise<'granted' | 'declined' | 'no-prompt'>;
}

/**
 * Wraps the dispatcher with first-run consent, telemetry init, and event
 * emission for the command lifecycle.
 *
 * Sequence:
 *   1. Resolve consent (env, stored config, first-run prompt if applicable)
 *   2. On first run: fire `cli.first-run` on `reporter.anonymous()` and
 *      *await* flush before continuing, then persist the consent + create
 *      the installation ID (if telemetry will be enabled)
 *   3. Pass the effective reporter (the injected one, or noop if declined)
 *      down to the command's run function
 *   4. Run the command, capture duration + exit code
 *   5. Fire `cli.command-invoked`
 *   6. Await final flush
 */
export async function withTelemetry(
  opts: WithTelemetryOptions
): Promise<number> {
  const consentInput = await resolveConsentInput(opts.promptOverride);
  const decision = decideConsent(consentInput);

  const isFirstRun =
    consentInput.kind === 'first-run-prompted' ||
    consentInput.kind === 'first-run-no-prompt';

  if (isFirstRun && decision.consent !== undefined) {
    // High-value event: fire on an anonymous sibling and *await* dispose
    // before continuing (dispose flushes pending events for real reporters
    // and is a noop for the recording/noop variants).
    const anonReporter = opts.reporter.anonymous();
    anonReporter.trackEvent('cli.first-run', { consent: decision.consent });
    await anonReporter.dispose();

    // Persist the user choice and create the installation ID. The choice
    // is persisted regardless of env override so subsequent runs know
    // what the user actually said.
    const userSaid =
      decision.consent === 'declined'
        ? false
        : // 'granted' or 'default_on': persist as enabled
          true;
    persistConsent(userSaid);

    if (decision.enabled) {
      State.getOrCreateInstallationId();
    }
  } else if (decision.enabled) {
    State.getOrCreateInstallationId();
  }

  // Effective reporter: the injected one if telemetry is on; noop otherwise.
  // The injected reporter has the installation ID baked in by its
  // constructor — we don't re-thread it here.
  const reporter: ITelemetryReporter = decision.enabled
    ? opts.reporter
    : NoopTelemetryReporter;

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

/**
 * Reads env vars and stored config to decide which `ConsentInput` variant
 * to feed into `decideConsent`. Issues a TTY prompt on first run.
 *
 * Exported for tests; the dispatcher wrapper composes it.
 */
export async function resolveConsentInput(
  promptOverride?: () => Promise<'granted' | 'declined' | 'no-prompt'>
): Promise<ConsentInput> {
  const envOverride = readEnvConfigSource().getTelemetryEnabled?.() ?? undefined;
  const rawConfig = readRawUserConfig();
  const storedRaw = rawConfig['telemetry.enabled'];

  if (typeof storedRaw === 'boolean') {
    return {
      kind: 'subsequent-run',
      storedConsent: storedRaw,
      envOverride,
    };
  }

  // First run.
  const prompt = promptOverride ?? promptFirstRunConsent;
  const result = await prompt();
  if (result === 'no-prompt') {
    return { kind: 'first-run-no-prompt', envOverride };
  }
  return {
    kind: 'first-run-prompted',
    promptResult: result,
    envOverride,
  };
}

function persistConsent(enabled: boolean): void {
  const raw = readRawUserConfig();
  raw['telemetry.enabled'] = enabled;
  writeRawUserConfig(raw);
}

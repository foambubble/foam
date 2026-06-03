import {
  ConsentInput,
  ITelemetryReporter,
  NoopTelemetryReporter,
  TELEMETRY_CONNECTION_STRING,
  bucketDuration,
  decideConsent,
} from '@foam/core';
import { promptFirstRunConsent } from './first-run';
import { getOrCreateInstallationId } from './state';
import { AppInsightsReporter } from './telemetry-reporter';
import { getCoreVersion, getCurrentVersion } from './version';
import {
  readEnvConfigSource,
  readRawUserConfig,
  writeRawUserConfig,
} from './user-config';

/**
 * Commands for which we do not emit any telemetry. The opt-out command is
 * the obvious one — firing telemetry for the command that disables telemetry
 * is gross. `--help` / `--version` paths are handled by short-circuiting
 * before withTelemetry is called.
 */
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

/**
 * Resolved telemetry context made available to the command. Commands that
 * need to emit telemetry under a different `component` (notably the `mcp`
 * subcommand, which hosts a `FoamMcpServer` that emits `mcp.*`) read the
 * installation ID + enabled flag from here and construct their own reporter.
 */
export interface TelemetryContext {
  /** True when telemetry is on for this run. */
  enabled: boolean;
  /** The installation ID, when telemetry is enabled; undefined otherwise. */
  installationId: string | undefined;
}

export interface WithTelemetryOptions {
  command: string;
  run: (ctx: TelemetryContext) => Promise<CommandRunResult>;
  /** For tests: replaces the AppInsightsReporter. */
  reporterFactory?: (installationId: string | undefined) => ITelemetryReporter;
  /** For tests: replaces the first-run prompt. */
  promptOverride?: () => Promise<'granted' | 'declined' | 'no-prompt'>;
}

interface RuntimeReporter extends ITelemetryReporter {
  flush?(): Promise<number>;
  dispose?(): Promise<void>;
}

/**
 * Wraps the dispatcher with first-run consent, telemetry init, and event
 * emission for the command lifecycle.
 *
 * Sequence:
 *   1. Resolve consent (env, stored config, first-run prompt if applicable)
 *   2. On first run: fire `cli.first-run` on an anonymous reporter and *await*
 *      flush before continuing, then persist the consent + installation ID
 *   3. Build the session reporter (real or noop based on consent)
 *   4. Run the command, capture duration + exit code
 *   5. Fire `cli.command-invoked`
 *   6. Await final flush
 */
export async function withTelemetry(
  opts: WithTelemetryOptions
): Promise<number> {
  const consentInput = await resolveConsentInput(opts.promptOverride);
  const decision = decideConsent(consentInput);

  // Persist the user's choice on a first run (regardless of env override),
  // and ensure an installation ID exists. Both must happen *before* we
  // build the main reporter.
  const isFirstRun =
    consentInput.kind === 'first-run-prompted' ||
    consentInput.kind === 'first-run-no-prompt';
  let installationId: string | undefined;

  if (isFirstRun && decision.consent !== undefined) {
    // Fire cli.first-run anonymously and *await* — it's a high-value event.
    const anonReporter = (opts.reporterFactory ?? defaultReporterFactory)(
      undefined
    ) as RuntimeReporter;
    anonReporter.trackEvent('cli.first-run', { consent: decision.consent });
    if (anonReporter.flush) {
      await anonReporter.flush();
    }

    // Persist the user choice (write to config) and create the installation ID.
    // We do this after the anonymous flush, but it doesn't actually matter:
    // the anonymous event carries no ID so the order is observationally identical.
    const userSaid =
      decision.consent === 'declined'
        ? false
        : decision.consent === 'granted'
          ? true
          : // default_on: persist as enabled so subsequent runs don't re-prompt
            true;
    persistConsent(userSaid);

    if (decision.enabled) {
      installationId = getOrCreateInstallationId().id;
    }
  } else if (decision.enabled) {
    installationId = getOrCreateInstallationId().id;
  }

  // Build the session reporter for the actual command.
  const reporter: RuntimeReporter = decision.enabled
    ? ((opts.reporterFactory ?? defaultReporterFactory)(
        installationId
      ) as RuntimeReporter)
    : (NoopTelemetryReporter as RuntimeReporter);

  const startedAt = Date.now();
  let exitCode = 1;
  let extraProps: Record<string, string> | undefined;
  const ctx: TelemetryContext = {
    enabled: decision.enabled,
    installationId,
  };
  try {
    const result = await opts.run(ctx);
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
    if (reporter.flush) {
      await reporter.flush();
    }
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

function defaultReporterFactory(
  installationId: string | undefined
): ITelemetryReporter {
  return new AppInsightsReporter({
    connectionString: TELEMETRY_CONNECTION_STRING,
    component: 'cli',
    componentVersion: getCurrentVersion(),
    coreVersion: getCoreVersion(),
    installationId,
  });
}

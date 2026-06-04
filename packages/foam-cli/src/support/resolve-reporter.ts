import { ConsentInput, ITelemetryReporter, NoopTelemetryReporter, decideConsent } from '@foam/core';
import { promptFirstRunConsent } from './first-run';
import { State } from './state';
import { readEnvConfigSource, readRawUserConfig, writeRawUserConfig } from './user-config';
import { shouldSkipTelemetry } from './with-telemetry';

export interface ResolveReporterOptions {
  /** Command name parsed from argv, or undefined when none was given. */
  command: string | undefined;
  /**
   * Factory for the real reporter.
   */
  buildReporter: (installationId: string) => ITelemetryReporter;
  /** For tests: replaces the first-run prompt. */
  promptOverride?: () => Promise<'granted' | 'declined' | 'no-prompt'>;
}

/**
 * Resolves consent and returns the effective reporter for this CLI invocation.
 *
 * Owns the full "setup" side of telemetry:
 *  - decides consent from env / stored config / first-run prompt
 *  - fires `cli.first-run` and persists the durable signal when one exists
 *  - creates the installation ID (only when telemetry will actually run)
 *  - returns either the built reporter (with ID baked in) or the noop
 *
 * Side effects on state.json are scoped to what's needed: the installation
 * ID is created only when we return a real reporter. Declined and env-opt-out
 * paths still build a reporter to own the anonymous `cli.first-run` fork,
 * but with `installationId: undefined` since the fork strips it anyway.
 *
 * Callers downstream of this (the dispatcher, command lifecycle wrapper)
 * just receive a reporter and use it — they have no consent or identity
 * concerns.
 */
export async function resolveCliReporter(
  opts: ResolveReporterOptions
): Promise<ITelemetryReporter> {
  // `config` (and bare/help invocations) opt out of telemetry entirely —
  // including the first-run prompt, because the user may be about to set
  // the preference and we shouldn't nag them mid-flight.
  if (shouldSkipTelemetry(opts.command)) {
    return NoopTelemetryReporter;
  }

  const input = await resolveConsentInput(opts.promptOverride);
  const decision = decideConsent(input);

  const isFirstRun = input.kind === 'first-run-prompted' || input.kind === 'first-run-no-prompt';
  if (isFirstRun) {
    // The anonymous fork strips identity, so we don't need a real ID here.
    const parent = opts.buildReporter('');
    const anonReporter = parent.anonymous();
    await parent.dispose();

    anonReporter.trackEvent('cli.first-run', { consent: decision.consent });
    await anonReporter.dispose();

    // `granted` / `default_on` → persist enabled=true; `declined` → false.
    const userSaid = decision.consent !== 'declined';
    persistConsent(userSaid);
  }

  return decision.enabled
    ? opts.buildReporter(State.getOrCreateInstallationId().id)
    : NoopTelemetryReporter;
}

async function resolveConsentInput(
  promptOverride?: () => Promise<'granted' | 'declined' | 'no-prompt'>
): Promise<ConsentInput> {
  const envOverride = readEnvConfigSource().getTelemetryEnabled?.() ?? undefined;
  const rawConfig = readRawUserConfig();
  const storedRaw = rawConfig['telemetry.enabled'];

  if (typeof storedRaw === 'boolean') {
    return { kind: 'subsequent-run', storedConsent: storedRaw, envOverride };
  }

  // First run. If the env var is set we skip the prompt — the user already
  // answered for this invocation, and nagging them anyway is poor UX. The
  // dedicated `first-run-env-override` variant signals to `decideConsent`
  // that this is ephemeral (no `cli.first-run`, no persistence).
  if (envOverride !== undefined) {
    return { kind: 'first-run-env-override', envOverride };
  }

  const prompt = promptOverride ?? promptFirstRunConsent;
  const result = await prompt();
  if (result === 'no-prompt') {
    return { kind: 'first-run-no-prompt', envOverride };
  }
  return { kind: 'first-run-prompted', promptResult: result, envOverride };
}

function persistConsent(enabled: boolean): void {
  const raw = readRawUserConfig();
  raw['telemetry.enabled'] = enabled;
  writeRawUserConfig(raw);
}

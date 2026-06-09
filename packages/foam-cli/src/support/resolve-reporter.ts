import { ConsentInput, ITelemetryReporter, NoopTelemetryReporter, decideConsent } from '@foam/core';
import { promptFirstRunConsent } from './first-run';
import { State } from './state';
import { readEnvTelemetryOverride, readRawUserConfig, writeRawUserConfig } from './user-config';
import { shouldSkipTelemetry } from './with-telemetry';

export interface ResolveReporterOptions {
  /**
   * Command name parsed from argv, or undefined when none was given.
   */
  command: string | undefined;
  /**
   * Args after the command word
   */
  commandArgs?: readonly string[];
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
  if (shouldSkipTelemetry(opts.command, opts.commandArgs)) {
    return NoopTelemetryReporter;
  }

  const input = await resolveConsentInput(opts.promptOverride);
  const decision = decideConsent(input);

  // Decide whether this run should emit a `cli.first-run` event. The
  // contract is "at most one event per consent outcome" — tracked durably
  // in state.json via `consentEventFired`:
  //   - undefined → no event ever fired. Any first-run path is eligible.
  //   - 'tty'     → a non-interactive default-on event fired. A *later*
  //                 interactive run can fire an upgrade event (granted/
  //                 declined) but a repeat no-prompt run is suppressed.
  //   - 'user'    → the user answered an interactive prompt. The decision
  //                 is final; no further events on any path.
  //
  // Persistence of `telemetry.enabled` (in user config) is independent and
  // only happens on `first-run-prompted` — the no-prompt path never
  // persists a choice the user didn't make, so the next interactive run
  // still prompts for real.
  if (input.kind === 'first-run-prompted' || input.kind === 'first-run-no-prompt') {
    const priorConsentEvent = State.read().consentEventFired;
    const newConsentState = input.kind === 'first-run-prompted' ? 'user' : 'tty';
    const shouldEmit = shouldEmitConsentEvent(priorConsentEvent, newConsentState);

    if (shouldEmit) {
      // The anonymous fork strips identity, so we don't need a real ID here.
      const parent = opts.buildReporter('');
      const anonReporter = parent.anonymous();
      await parent.dispose();

      anonReporter.trackEvent('cli.first-run', { consent: decision.consent });
      await anonReporter.dispose();

      State.patch({ consentEventFired: newConsentState });
    }

    if (input.kind === 'first-run-prompted') {
      // `granted` → persist enabled=true; `declined` → false.
      const userSaid = decision.consent !== 'declined';
      persistConsent(userSaid);
    }
  }

  return decision.enabled
    ? opts.buildReporter(State.getOrCreateInstallationId().id)
    : NoopTelemetryReporter;
}

/**
 * `cli.first-run` dedup rules. Returns true iff the incoming consent
 * outcome is strictly stronger than what we've already recorded.
 *
 *   prior     | incoming | emit?
 *   ----------|----------|------
 *   undefined | tty      | yes
 *   undefined | user     | yes
 *   tty       | tty      | no  (repeat no-prompt — already counted)
 *   tty       | user     | yes (upgrade — user finally answered)
 *   user      | tty      | no  (the user previously answered)
 *   user      | user     | no  (already answered)
 */
function shouldEmitConsentEvent(
  prior: 'tty' | 'user' | undefined,
  incoming: 'tty' | 'user'
): boolean {
  if (prior === undefined) return true;
  if (prior === 'tty' && incoming === 'user') return true;
  return false;
}

async function resolveConsentInput(
  promptOverride?: () => Promise<'granted' | 'declined' | 'no-prompt'>
): Promise<ConsentInput> {
  const envOverride = readEnvTelemetryOverride();
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

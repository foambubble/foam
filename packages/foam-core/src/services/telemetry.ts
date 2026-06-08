/**
 * Telemetry abstraction shared across all Foam components (VS Code extension, CLI, MCP).
 *
 * Core defines the *interface* and helpers. Each component provides its own
 * implementation (App Insights via @vscode/extension-telemetry for the extension,
 * the `applicationinsights` Node SDK for CLI and MCP).
 *
 * Core code itself must never depend on a concrete reporter — pass `NoopTelemetryReporter`
 * when no reporting is wanted.
 */

export interface ITelemetryReporter {
  trackEvent(name: string, properties?: Record<string, string>): void;
  trackError(context: string, error: unknown, properties?: Record<string, string>): void;
  /**
   * Returns a sibling reporter that emits events tagged with a different
   * component. Implementations share underlying state (queue, identity)
   * where it makes sense — only the `foam.component` tag differs.
   */
  forComponent(
    component: string,
    forkOpts?: { autoFlush?: { maxQueueSize: number } }
  ): ITelemetryReporter;
  /**
   * Returns a sibling reporter that suppresses identity-revealing common
   * properties (the installation ID, the OS platform, the Node version).
   * Used by `cli.first-run`, which carries opt-out rate but must remain
   * unattributable to a specific installation.
   */
  anonymous(): ITelemetryReporter;
  /**
   * Releases any resources held by this reporter and ensures pending work
   * (queued events, in-flight POSTs, etc.) is completed. Must be safe to
   * call multiple times and on a never-used reporter.
   *
   * Async because real reporters need to await network I/O before exit.
   * Not assignable to {@link IDisposable} — that contract is synchronous.
   */
  dispose(): Promise<void>;
}

export const NoopTelemetryReporter: ITelemetryReporter = {
  trackEvent() {
    /* noop */
  },
  trackError() {
    /* noop */
  },
  forComponent() {
    return NoopTelemetryReporter;
  },
  anonymous() {
    return NoopTelemetryReporter;
  },
  async dispose() {
    /* noop */
  },
};

/**
 * Test helper: records every call so tests can assert on the resulting
 * event stream. Not intended for production use.
 */
export class InMemoryTelemetryReporter implements ITelemetryReporter {
  readonly events: Array<{
    name: string;
    properties?: Record<string, string>;
  }> = [];
  readonly errors: Array<{
    context: string;
    errorType: string;
    properties?: Record<string, string>;
  }> = [];

  trackEvent(name: string, properties?: Record<string, string>): void {
    this.events.push({ name, properties });
  }

  trackError(context: string, error: unknown, properties?: Record<string, string>): void {
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    this.errors.push({ context, errorType, properties });
  }

  forComponent(): ITelemetryReporter {
    return new InMemoryTelemetryReporter();
  }

  anonymous(): ITelemetryReporter {
    return new InMemoryTelemetryReporter();
  }

  async dispose(): Promise<void> {
    /* noop — there's nothing to release; events stay in memory for assertions */
  }

  reset(): void {
    this.events.length = 0;
    this.errors.length = 0;
  }
}

// Bucketing utilities — kept in core so every component buckets the same way.

export type WorkspaceSizeBucket =
  | '0'
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-500'
  | '501-1000'
  | '1001-2000'
  | '2001-5000'
  | '5001-10000'
  | '10000+';

export function bucketNoteCount(count: number): WorkspaceSizeBucket {
  if (count === 0) return '0';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '501-1000';
  if (count <= 2000) return '1001-2000';
  if (count <= 5000) return '2001-5000';
  if (count <= 10000) return '5001-10000';
  return '10000+';
}

export type DurationBucket = '<10ms' | '<50ms' | '<500ms' | '<5s' | '<30s' | '30s+';

export function bucketDuration(ms: number): DurationBucket {
  if (ms < 10) return '<10ms';
  if (ms < 50) return '<50ms';
  if (ms < 500) return '<500ms';
  if (ms < 5000) return '<5s';
  if (ms < 30000) return '<30s';
  return '30s+';
}

// =============================================================================
// First-run consent and connection string
// =============================================================================

/**
 * The Azure Application Insights connection string used by every Foam component.
 *
 * Not a secret: ingestion-only credentials — anyone can write events, no one
 * can read them via this string
 */
export const TELEMETRY_CONNECTION_STRING =
  'InstrumentationKey=58799bee-3769-4118-87f7-00947bd5db7b;IngestionEndpoint=https://northeurope-2.in.applicationinsights.azure.com/;LiveEndpoint=https://northeurope.livediagnostics.monitor.azure.com/;ApplicationId=dc5e45aa-1fb1-4ff5-9924-0ca0ef60f43f';

/**
 * Text shown by the CLI on first run when an interactive prompt is possible.
 * Printed to stderr before reading the user's choice from stdin.
 */
export const TELEMETRY_FIRST_RUN_NOTICE = `Foam collects anonymous usage data to help improve the tool — which
commands the user runs, how long they take, and the bucketed size of
the workspace (e.g. "201-500 notes", never the actual count). Foam
never collects note content, file names, paths, or anything that could
identify the user. See https://docs.foamnotes.com/user/tools/telemetry
for full details.

Telemetry is on by default. It can be disabled now (n), left
on (Y), or changed later by updating the config or with FOAM_TELEMETRY=0.`;

/**
 * Outcome of the first-run consent flow, emitted as the `consent` property
 * on `cli.first-run`.
 *
 * `granted` / `declined` come from an interactive prompt and are also
 * persisted to user config so the next run is a `subsequent-run`.
 *
 * `default_on` describes the non-interactive default — we couldn't ask,
 * so telemetry runs for the session but no choice is persisted.
 */
export type ConsentValue = 'granted' | 'declined' | 'default_on';

/**
 * Inputs to the pure {@link decideConsent} function. A discriminated union
 * so each variant carries exactly the inputs that case needs.
 */
export type ConsentInput =
  | {
      /** A previous run already recorded a choice; we are not on a first run. */
      kind: 'subsequent-run';
      storedConsent: boolean;
      envOverride: boolean | undefined;
    }
  | {
      /** First run, prompt was shown and the user answered. */
      kind: 'first-run-prompted';
      promptResult: 'granted' | 'declined';
      envOverride: boolean | undefined;
    }
  | {
      /** First run, but no prompt was possible (no TTY, CI, piped stdin). */
      kind: 'first-run-no-prompt';
      envOverride: boolean | undefined;
    }
  | {
      /**
       * First run, but the env var was set so the prompt was skipped — the
       * user answered via env. Treated as ephemeral: callers should not
       * persist this and should suppress `cli.first-run` (no durable user
       * signal to record).
       */
      kind: 'first-run-env-override';
      envOverride: boolean;
    };

/**
 * The result of resolving consent for a given run.
 *
 * - `enabled`: whether telemetry is on for the rest of this process.
 * - `consent`: the `ConsentValue` to emit with `cli.first-run`. Defined only
 *   on the two first-run variants; on subsequent runs no first-run event
 *   should fire, so `consent` is undefined.
 */
export interface ConsentDecision {
  enabled: boolean;
  consent: ConsentValue | undefined;
}

/**
 * Resolves whether telemetry is enabled for this run, and (on first runs)
 * what `consent` value to record on the `cli.first-run` event.
 *
 * Precedence: env var override > stored value (subsequent run) or prompt
 * result / default (first run).
 *
 * Pure — no I/O, no env reads. The caller composes the inputs.
 */
export function decideConsent(input: ConsentInput): ConsentDecision {
  switch (input.kind) {
    case 'subsequent-run': {
      const enabled = input.envOverride ?? input.storedConsent;
      return { enabled, consent: undefined };
    }
    case 'first-run-prompted': {
      const promptedEnabled = input.promptResult === 'granted';
      const enabled = input.envOverride ?? promptedEnabled;
      return {
        enabled,
        consent: promptedEnabled ? 'granted' : 'declined',
      };
    }
    case 'first-run-no-prompt': {
      // No prompt was possible — default to on. Record `default_on` so we
      // can distinguish "explicitly accepted" from "couldn't ask".
      const enabled = input.envOverride ?? true;
      return { enabled, consent: 'default_on' };
    }
    case 'first-run-env-override': {
      // Env var alone decided this run. No durable user signal — `consent`
      // is undefined so callers know to suppress `cli.first-run` and skip
      // persistence. The next un-overridden run will prompt for real.
      return { enabled: input.envOverride, consent: undefined };
    }
  }
}

// =============================================================================
// App Insights envelope construction
// =============================================================================

/**
 * Parsed form of an App Insights connection string (`key1=value1;key2=value2;...`).
 *
 * Connection strings always carry `InstrumentationKey` and `IngestionEndpoint`;
 * `LiveEndpoint` and `ApplicationId` are commonly present but not strictly
 * required.
 */
export interface AppInsightsConnection {
  instrumentationKey: string;
  ingestionEndpoint: string;
  liveEndpoint?: string;
  applicationId?: string;
}

/**
 * Parses an App Insights connection string. Throws on missing required fields
 * (`InstrumentationKey`, `IngestionEndpoint`).
 */
export function parseAppInsightsConnectionString(connectionString: string): AppInsightsConnection {
  const pairs = connectionString
    .split(';')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const parsed: Record<string, string> = {};
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    parsed[key.toLowerCase()] = value;
  }

  const instrumentationKey = parsed['instrumentationkey'];
  const ingestionEndpoint = parsed['ingestionendpoint'];

  if (!instrumentationKey) {
    throw new Error('App Insights connection string is missing InstrumentationKey');
  }
  if (!ingestionEndpoint) {
    throw new Error('App Insights connection string is missing IngestionEndpoint');
  }

  return {
    instrumentationKey,
    ingestionEndpoint: ingestionEndpoint.replace(/\/$/, ''),
    liveEndpoint: parsed['liveendpoint']?.replace(/\/$/, ''),
    applicationId: parsed['applicationid'],
  };
}

/**
 * Inputs for building an App Insights `Event` envelope. The caller is
 * responsible for filtering out forbidden properties (user paths, file
 * names, etc.) before calling — this function does not sanitize.
 */
export interface AppInsightsEventInput {
  instrumentationKey: string;
  eventName: string;
  properties?: Record<string, string>;
  /** ISO-8601 timestamp; defaults to "now" via the caller. */
  timestamp: string;
  /** Optional SDK identifier — appears in `tags["ai.internal.sdkVersion"]`. */
  sdkVersion?: string;
  /** Optional anonymous user id — appears in `tags["ai.user.id"]`. */
  userId?: string;
}

/**
 * Builds a single App Insights "Event" telemetry envelope ready to POST to
 * the ingestion endpoint as a JSON line. The Track API accepts either a
 * single envelope or a newline-separated batch.
 *
 * Pure — returns a plain object. Network and serialization happen in the
 * reporter.
 */
export function buildAppInsightsEnvelope(input: AppInsightsEventInput): Record<string, unknown> {
  const tags: Record<string, string> = {};
  if (input.sdkVersion) tags['ai.internal.sdkVersion'] = input.sdkVersion;
  if (input.userId) tags['ai.user.id'] = input.userId;

  return {
    name: `Microsoft.ApplicationInsights.${input.instrumentationKey.replace(/-/g, '')}.Event`,
    time: input.timestamp,
    iKey: input.instrumentationKey,
    tags,
    data: {
      baseType: 'EventData',
      baseData: {
        ver: 2,
        name: input.eventName,
        properties: input.properties ?? {},
      },
    },
  };
}

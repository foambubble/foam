import {
  AppInsightsConnection,
  ITelemetryReporter,
  Logger,
  NoopTelemetryReporter,
  buildAppInsightsEnvelope,
  parseAppInsightsConnectionString,
} from '@foam/core';

/**
 * HTTP transport. Pulled out so tests can inject a fake without
 * touching the network.
 */
export type HttpPoster = (
  url: string,
  body: string
) => Promise<{ status: number }>;

/**
 * Hard cap on flush latency. Telemetry is best-effort by contract — a slow
 * or stalled ingestion endpoint must never delay the user's command.
 */
const FLUSH_TIMEOUT_MS = 1000;

/**
 * Real HTTPS POST to the App Insights ingestion endpoint. Production code
 * paths pass this explicitly into `AppInsightsReporter` — there is no
 * default for `poster`, so a forgotten wiring never silently posts.
 *
 * Aborted after {@link FLUSH_TIMEOUT_MS} so corporate proxies / DNS stalls
 * can't hold the process open until the OS TCP timeout.
 */
export const httpsPoster: HttpPoster = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-json-stream' },
    body,
    signal: AbortSignal.timeout(FLUSH_TIMEOUT_MS),
  });
  return { status: res.status };
};

export interface AppInsightsReporterOptions {
  connectionString: string;
  component: 'cli' | 'mcp';
  componentVersion: string;
  coreVersion: string;
  /** When omitted, no ai.user.id tag is sent (used for cli.first-run). */
  installationId?: string;
  /** Required. Production passes {@link httpsPoster}; tests inject a fake. */
  poster: HttpPoster;
  /** Defaults to () => new Date().toISOString(). */
  clock?: () => string;
}

interface QueuedEnvelope {
  envelope: Record<string, unknown>;
}

/**
 * Best-effort App Insights reporter for Node-hosted Foam components.
 *
 * - Buffers events in memory; the caller must `flush()` (or `dispose()`)
 *   to actually POST.
 * - Failures are logged at debug and swallowed — telemetry must never make
 *   the CLI slower or fail more often.
 * - Adds the common Foam properties (`foam.component`, `foam.version`,
 *   `foam.coreVersion`, `node.version`, `os.platform`) to every event,
 *   so call sites only carry the event-specific bits.
 *
 * `forComponent` / `anonymous` are pure factories: they return an
 * independent reporter that shares configuration (connection, identity,
 * poster, clock) with the source but has its own queue and lifecycle.
 * Disposing one does not affect the other.
 */
export class AppInsightsReporter implements ITelemetryReporter {
  private readonly conn: AppInsightsConnection;
  private readonly clock: () => string;
  private readonly poster: HttpPoster;
  private readonly opts: AppInsightsReporterOptions;
  private readonly queue: QueuedEnvelope[] = [];
  /** When true, `composeProperties` skips OS/Node so the event is unattributable. */
  private readonly anonymized: boolean;

  constructor(opts: AppInsightsReporterOptions, anonymized = false) {
    this.opts = opts;
    this.conn = parseAppInsightsConnectionString(opts.connectionString);
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this.poster = opts.poster;
    this.anonymized = anonymized;
  }

  trackEvent(name: string, properties?: Record<string, string>): void {
    const envelope = buildAppInsightsEnvelope({
      instrumentationKey: this.conn.instrumentationKey,
      eventName: name,
      properties: this.composeProperties(properties),
      timestamp: this.clock(),
      sdkVersion: `foam-${this.opts.component}:${this.opts.componentVersion}`,
      userId: this.anonymized ? undefined : this.opts.installationId,
    });
    this.queue.push({ envelope });
    Logger.debug(`[telemetry] queued ${name}`);
  }

  trackError(
    context: string,
    error: unknown,
    properties?: Record<string, string>
  ): void {
    const errorType =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    this.trackEvent(`${this.opts.component}.error`, {
      context,
      errorType,
      ...properties,
    });
  }

  /**
   * Returns an independent reporter scoped to a different component.
   * Inherits connection/identity from this one; has its own queue.
   * The new reporter must be disposed separately.
   */
  forComponent(component: string): ITelemetryReporter {
    return new AppInsightsReporter(
      {
        ...this.opts,
        component: component as AppInsightsReporterOptions['component'],
      },
      this.anonymized
    );
  }

  /**
   * Returns an independent reporter that drops the installation ID tag
   * and skips OS / Node version in common properties. Used for
   * `cli.first-run`. Must be disposed separately.
   */
  anonymous(): ITelemetryReporter {
    return new AppInsightsReporter(
      { ...this.opts, installationId: undefined },
      true
    );
  }

  /**
   * POSTs every queued event in a single newline-separated batch.
   * Resolves once the POST completes, fails, or {@link FLUSH_TIMEOUT_MS}
   * elapses — whichever comes first. Failures (including timeout) are
   * swallowed and logged at debug.
   *
   * Returns the number of events sent. Useful for tests; production code
   * can ignore it.
   */
  async flush(): Promise<number> {
    if (this.queue.length === 0) return 0;

    const batch = this.queue.splice(0, this.queue.length);

    const body = batch.map(b => JSON.stringify(b.envelope)).join('\n');
    const url = `${this.conn.ingestionEndpoint}/v2/track`;

    const post = this.poster(url, body).then(
      res => {
        if (res.status >= 400) {
          Logger.debug(`[telemetry] flush returned ${res.status}`);
        }
      },
      e => {
        const msg = e instanceof Error ? e.message : String(e);
        Logger.debug(`[telemetry] flush failed: ${msg}`);
      }
    );

    const timeout = new Promise<void>(resolve => {
      const handle = setTimeout(() => {
        Logger.debug(`[telemetry] flush timed out after ${FLUSH_TIMEOUT_MS}ms`);
        resolve();
      }, FLUSH_TIMEOUT_MS);
      // Don't let a pending timer hold the event loop open if the post
      // resolves first — the timer is purely a deadline, not a task.
      handle.unref?.();
    });

    await Promise.race([post, timeout]);

    return batch.length;
  }

  async dispose(): Promise<void> {
    await this.flush();
  }

  private composeProperties(
    extra?: Record<string, string>
  ): Record<string, string> {
    const common: Record<string, string> = {
      'foam.component': this.opts.component,
      'foam.version': this.opts.componentVersion,
      'foam.coreVersion': this.opts.coreVersion,
    };
    if (!this.anonymized) {
      common['node.version'] = process.version;
      common['os.platform'] = process.platform;
    }
    return { ...common, ...extra };
  }
}

// Re-export so callers can pass `NoopTelemetryReporter` from one place.
export { NoopTelemetryReporter };

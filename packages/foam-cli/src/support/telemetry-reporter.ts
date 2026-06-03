import {
  AppInsightsConnection,
  ITelemetryReporter,
  Logger,
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

const defaultPoster: HttpPoster = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-json-stream' },
    body,
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
  /** Allows tests to inject a fake. Defaults to global fetch. */
  poster?: HttpPoster;
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
 */
export class AppInsightsReporter implements ITelemetryReporter {
  private readonly conn: AppInsightsConnection;
  private readonly clock: () => string;
  private readonly poster: HttpPoster;
  private readonly opts: AppInsightsReporterOptions;
  private queue: QueuedEnvelope[] = [];

  constructor(opts: AppInsightsReporterOptions) {
    this.opts = opts;
    this.conn = parseAppInsightsConnectionString(opts.connectionString);
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this.poster = opts.poster ?? defaultPoster;
  }

  trackEvent(name: string, properties?: Record<string, string>): void {
    const envelope = buildAppInsightsEnvelope({
      instrumentationKey: this.conn.instrumentationKey,
      eventName: name,
      properties: this.composeProperties(properties),
      timestamp: this.clock(),
      sdkVersion: `foam-${this.opts.component}:${this.opts.componentVersion}`,
      userId: this.opts.installationId,
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
   * POSTs every queued event in a single newline-separated batch.
   * Resolves once the POST completes (or fails — failures are swallowed).
   *
   * Returns the number of events sent. Useful for tests; production code
   * can ignore it.
   */
  async flush(): Promise<number> {
    if (this.queue.length === 0) return 0;

    const batch = this.queue;
    this.queue = [];

    const body = batch.map(b => JSON.stringify(b.envelope)).join('\n');
    const url = `${this.conn.ingestionEndpoint}/v2/track`;

    try {
      const res = await this.poster(url, body);
      if (res.status >= 400) {
        Logger.debug(`[telemetry] flush returned ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Logger.debug(`[telemetry] flush failed: ${msg}`);
    }

    return batch.length;
  }

  async dispose(): Promise<void> {
    await this.flush();
  }

  private composeProperties(
    extra?: Record<string, string>
  ): Record<string, string> {
    return {
      'foam.component': this.opts.component,
      'foam.version': this.opts.componentVersion,
      'foam.coreVersion': this.opts.coreVersion,
      'node.version': process.version,
      'os.platform': process.platform,
      ...extra,
    };
  }
}

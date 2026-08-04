/**
 * Measurements of the JavaScript host Foam runs in — the VS Code extension
 * host, the CLI process, or a test runner. Used to complete the load report
 * (see `LoadProfiler`, issue #1689).
 *
 * Everything here is host-agnostic by construction: no Node-only APIs are
 * assumed (`process` is feature-detected, `unref` is optional-chained), so it
 * is safe in the browser and React Native targets too.
 */

/**
 * Measures how long the host event loop is blocked.
 *
 * In VS Code, Foam shares a single thread with every other extension. When a
 * workspace load takes far longer than the work Foam actually does (issue
 * #1689), the missing time is either Foam blocking the thread with one long
 * synchronous parse, or Foam being starved by something else on that thread —
 * including V8 spending its time in GC. Those need different fixes, and only
 * the lag distinguishes them:
 *
 * - `maxLagMs` close to Foam's slowest single parse → Foam is the blocker
 * - `maxLagMs` much larger → something else on the extension host is
 *
 * In the CLI there is nothing else on the thread, so the lag is Foam's own
 * blocking plus GC — the baseline to compare an extension-host run against.
 *
 * A timer scheduled every {@link INTERVAL_MS} that fires N ms late means the
 * loop was blocked for ~N ms.
 */
const INTERVAL_MS = 100;

export class EventLoopMonitor {
  private timer: ReturnType<typeof setInterval> | undefined;
  private expectedAt = 0;
  private _maxLagMs = 0;
  private _totalLagMs = 0;
  private _samples = 0;

  /** Longest single stall observed, in ms */
  get maxLagMs(): number {
    return this._maxLagMs;
  }

  /** Sum of all stalls — how much of the wall clock the loop was unavailable */
  get totalLagMs(): number {
    return this._totalLagMs;
  }

  get samples(): number {
    return this._samples;
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.expectedAt = performance.now() + INTERVAL_MS;
    this.timer = setInterval(() => {
      const lag = Math.max(0, performance.now() - this.expectedAt);
      this.expectedAt = performance.now() + INTERVAL_MS;
      this._maxLagMs = Math.max(this._maxLagMs, lag);
      this._totalLagMs += lag;
      this._samples += 1;
    }, INTERVAL_MS);
    // don't hold the process open on the CLI/test hosts
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Single line for the load report */
  format(): string {
    return `max ${Math.round(this._maxLagMs)} ms, total ${Math.round(
      this._totalLagMs
    )} ms over ${this._samples} samples`;
  }
}

/**
 * Heap usage of the host process, or `unavailable` where there is no
 * `process`, as on the web extension host.
 *
 * `heapUsed` right after a load is dominated by garbage that has not been
 * collected yet, so a large number here is a signal about allocation churn, not
 * about retained memory.
 */
export function formatMemoryUsage(): string {
  const usage = globalThis.process?.memoryUsage?.();
  if (!usage) {
    return 'unavailable';
  }
  const mib = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MiB`;
  return `heapUsed ${mib(usage.heapUsed)}, heapTotal ${mib(
    usage.heapTotal
  )}, rss ${mib(usage.rss)}`;
}

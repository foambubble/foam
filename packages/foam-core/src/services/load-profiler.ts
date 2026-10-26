import { URI } from '../model/uri';
import { IDataStore } from './datastore';

/**
 * Records where time goes while the workspace is being loaded.
 *
 * The plain `Workspace loaded in Xms` timing is wall clock around an await
 * chain, so on its own it cannot tell "Foam burned N minutes of CPU" apart from
 * "Foam waited N minutes for a busy extension host". This profiler splits that
 * wall clock into the work Foam actually does — reading files and parsing
 * markdown — and reports the remainder as unaccounted time.
 *
 * See issue #1689, where a user reported a 4789477ms (~80 min) workspace load
 * for a corpus that parses in ~14s.
 */

/** How many of the slowest notes to keep for the report. */
const SLOWEST_COUNT = 10;

export interface ParseSample {
  uri: URI;
  /** Length of the markdown source, in characters */
  chars: number;
  ms: number;
  /** Whether the parser cache served this parse */
  cacheHit: boolean;
}

export interface LoadProfileStats {
  /**
   * `totalMs` is the wall clock attributed to reading, as defined in
   * {@link LoadProfiler.formatReport}; `maxMs` is the slowest single read
   */
  read: { count: number; totalMs: number; maxMs: number; totalBytes: number };
  parse: { count: number; totalMs: number; maxMs: number; totalChars: number };
  cache: { hits: number; misses: number };
  /** The slowest parses, descending. At most {@link SLOWEST_COUNT} entries. */
  slowest: ParseSample[];
}

export class LoadProfiler {
  private startedAt: number | undefined;
  private stoppedAt: number | undefined;
  private recording = false;

  private readCount = 0;
  private readMaxMs = 0;
  private readTotalBytes = 0;
  /** Reads started and not yet settled, kept up to date outside recording too */
  private readsInFlight = 0;
  /** Start of the read time not yet in {@link readMs}, while a read is in flight */
  private readingSince = 0;
  /** Time with a read in flight and no parse running */
  private readMs = 0;

  private parseCount = 0;
  private parseTotalMs = 0;
  private parseTotalChars = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  /** Ascending by ms, capped at {@link SLOWEST_COUNT} — no unbounded sample array */
  private slowest: ParseSample[] = [];

  /**
   * @param now the clock, in ms, for the recording window and for reads. Parse
   * durations arrive already measured in {@link ParseSample}, and must be on
   * the same clock.
   */
  constructor(private readonly now: () => number = () => performance.now()) {}

  /**
   * Begins recording. Samples taken outside a start/stop window are ignored, so
   * the instrumentation the parser and data store keep for the rest of the
   * session costs one boolean check per call rather than accumulating forever.
   */
  start(): void {
    this.startedAt = this.now();
    this.stoppedAt = undefined;
    this.recording = true;
    // a read already in flight counts from here
    this.readingSince = this.startedAt;
  }

  stop(): void {
    this.stoppedAt = this.now();
    if (this.recording && this.readsInFlight > 0) {
      this.readMs += this.stoppedAt - this.readingSince;
    }
    this.recording = false;
  }

  /**
   * Wall clock between {@link start} and {@link stop}, or up to now if the
   * profiler is still running. `0` if it was never started.
   */
  get wallMs(): number {
    if (this.startedAt === undefined) {
      return 0;
    }
    return (this.stoppedAt ?? this.now()) - this.startedAt;
  }

  /** @returns when the read started, to pass to {@link readSettled} */
  private readStarted(): number {
    const t = this.now();
    if (this.readsInFlight++ === 0) {
      this.readingSince = t;
    }
    return t;
  }

  private readSettled(readStart: number, bytes: number): void {
    this.readsInFlight -= 1;
    if (!this.recording) {
      return;
    }
    const t = this.now();
    if (this.readsInFlight === 0) {
      this.readMs += t - this.readingSince;
    }
    this.readCount += 1;
    this.readMaxMs = Math.max(this.readMaxMs, t - readStart);
    this.readTotalBytes += bytes;
  }

  recordParse(sample: ParseSample): void {
    if (!this.recording) {
      return;
    }
    // a parse is synchronous, so a read in flight now was in flight all through
    // it: read time stops where the parse began and resumes from here
    if (this.readsInFlight > 0) {
      const t = this.now();
      this.readMs += t - sample.ms - this.readingSince;
      this.readingSince = t;
    }
    this.parseCount += 1;
    this.parseTotalMs += sample.ms;
    this.parseTotalChars += sample.chars;
    sample.cacheHit ? (this.cacheHits += 1) : (this.cacheMisses += 1);

    // keep only the slowest few, cheapest insertion for an almost-always-reject
    if (
      this.slowest.length === SLOWEST_COUNT &&
      sample.ms <= this.slowest[0].ms
    ) {
      return;
    }
    const at = this.slowest.findIndex(s => s.ms > sample.ms);
    this.slowest.splice(at === -1 ? this.slowest.length : at, 0, sample);
    if (this.slowest.length > SLOWEST_COUNT) {
      this.slowest.shift();
    }
  }

  getStats(): LoadProfileStats {
    return {
      read: {
        count: this.readCount,
        totalMs: this.readMs,
        maxMs: this.readMaxMs,
        totalBytes: this.readTotalBytes,
      },
      parse: {
        count: this.parseCount,
        totalMs: this.parseTotalMs,
        maxMs: this.slowest[this.slowest.length - 1]?.ms ?? 0,
        totalChars: this.parseTotalChars,
      },
      cache: { hits: this.cacheHits, misses: this.cacheMisses },
      slowest: [...this.slowest].reverse(),
    };
  }

  /**
   * Returns a data store that reports the cost of every {@link IDataStore.read}
   * to this profiler. All other operations are delegated untouched.
   */
  instrumentDataStore(dataStore: IDataStore): IDataStore {
    return {
      list: pattern => dataStore.list(pattern),
      read: async uri => {
        const start = this.readStarted();
        let content: string | null = null;
        try {
          content = await dataStore.read(uri);
          return content;
        } finally {
          // a read that rejects must settle too, or it stays in flight for good
          this.readSettled(start, content?.length ?? 0);
        }
      },
      write: (uri, content) => dataStore.write(uri, content),
      delete: uri => dataStore.delete(uri),
      move: (from, to) => dataStore.move(from, to),
      exists: uri => dataStore.exists(uri),
    };
  }

  /**
   * Observer to pass to `createMarkdownParser`.
   */
  readonly onParse = (sample: ParseSample): void => this.recordParse(sample);

  /**
   * A copy-pasteable block for issue reports.
   *
   * Reads overlap one another and the parses, so their latencies are not
   * summed. Instead each instant between {@link start} and {@link stop} goes to
   * exactly one of three lines, which add up to the wall clock:
   *
   * - `markdown parse`: a parse is running. Parses are synchronous, so they
   *   never overlap one another and nothing else on the thread runs meanwhile.
   * - `file read`: no parse is running and at least one read is in flight. A
   *   read is in flight until its result is back on the thread, so this
   *   includes waiting for a thread kept busy by something else.
   * - `unaccounted`: neither — Foam's other load work, such as listing files and
   *   building the graph, or the thread busy elsewhere with no read pending.
   *
   * The `slowest` read is the latency of a single read.
   *
   * @param extra additional lines to append, e.g. host-specific measurements
   * that `@foam/core` cannot take itself (heap usage, event loop lag)
   */
  formatReport(extra: Record<string, string> = {}): string {
    const stats = this.getStats();
    const wall = this.wallMs;
    const accounted = stats.read.totalMs + stats.parse.totalMs;
    const unaccounted = Math.max(0, wall - accounted);
    const pct = (n: number) => (wall > 0 ? Math.round((n / wall) * 100) : 0);

    const entries: Array<[string, string]> = [
      ['wall clock', ms(wall)],
      [
        'file read',
        `${ms(stats.read.totalMs)} (${pct(stats.read.totalMs)}%) over ${
          stats.read.count
        } files, ${mib(stats.read.totalBytes)}, slowest ${ms(
          stats.read.maxMs
        )}`,
      ],
      [
        'markdown parse',
        `${ms(stats.parse.totalMs)} (${pct(stats.parse.totalMs)}%) over ${
          stats.parse.count
        } notes, ${mchars(stats.parse.totalChars)}, slowest ${ms(
          stats.parse.maxMs
        )}`,
      ],
      ['unaccounted', `${ms(unaccounted)} (${pct(unaccounted)}%)`],
      [
        'parser cache',
        `${stats.cache.hits} hits, ${stats.cache.misses} misses`,
      ],
      ...Object.entries(extra),
    ];

    const width = Math.max(...entries.map(([key]) => key.length)) + 2;
    const lines = ['Foam load report'];
    for (const [key, value] of entries) {
      lines.push(`  ${(key + ':').padEnd(width)}${value}`);
    }

    if (stats.slowest.length > 0) {
      lines.push('  slowest notes to parse:');
      for (const s of stats.slowest) {
        lines.push(
          `    ${ms(s.ms).padStart(10)}  ${mchars(s.chars).padStart(10)}  ${
            s.cacheHit ? '(cached) ' : ''
          }${s.uri.path}`
        );
      }
    }

    // parse cost grows super-linearly with note size (remark-parse v8), so a
    // single huge note can dominate the whole load — call it out explicitly
    const worst = stats.slowest[0];
    if (worst && stats.parse.totalMs > 0) {
      const share = Math.round((worst.ms / stats.parse.totalMs) * 100);
      if (share >= 25) {
        lines.push(
          `  note: ${share}% of all parse time is a single note (${mchars(
            worst.chars
          )})`
        );
      }
    }

    return lines.join('\n');
  }
}

const ms = (n: number) => `${Math.round(n)} ms`;
const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const mchars = (chars: number) =>
  chars >= 1024 * 1024
    ? `${(chars / 1024 / 1024).toFixed(1)} Mchars`
    : `${Math.round(chars / 1024)} Kchars`;

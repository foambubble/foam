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
  trackError(
    context: string,
    error: unknown,
    properties?: Record<string, string>
  ): void;
}

export const NoopTelemetryReporter: ITelemetryReporter = {
  trackEvent() {
    /* noop */
  },
  trackError() {
    /* noop */
  },
};

/**
 * Test helper: records every call so tests can assert on the resulting event stream.
 * Not intended for production use.
 */
export class RecordingTelemetryReporter implements ITelemetryReporter {
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

  trackError(
    context: string,
    error: unknown,
    properties?: Record<string, string>
  ): void {
    const errorType =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    this.errors.push({ context, errorType, properties });
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
  | '500-1000'
  | '1000-2000'
  | '2000-5000'
  | '5000-10000'
  | '10000+';

export function bucketNoteCount(count: number): WorkspaceSizeBucket {
  if (count === 0) return '0';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '500-1000';
  if (count <= 2000) return '1000-2000';
  if (count <= 5000) return '2000-5000';
  if (count <= 10000) return '5000-10000';
  return '10000+';
}

export type DurationBucket =
  | '<10ms'
  | '<50ms'
  | '<500ms'
  | '<5s'
  | '<30s'
  | '30s+';

export function bucketDuration(ms: number): DurationBucket {
  if (ms < 10) return '<10ms';
  if (ms < 50) return '<50ms';
  if (ms < 500) return '<500ms';
  if (ms < 5000) return '<5s';
  if (ms < 30000) return '<30s';
  return '30s+';
}

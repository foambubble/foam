import {
  ITelemetryReporter,
  bucketDuration,
} from '@foam/core';

/**
 * Wraps a tool handler to fire `mcp.tool-invoked` (and `mcp.error` on
 * failure) for every invocation. The provided `onInvoked` callback fires
 * after every successful or failed invocation, so the server can drive
 * the once-per-session `mcp.session-with-tool` event.
 *
 * Composed *outside* `withToolErrorHandling` so the inner wrapper still
 * converts thrown errors to a structured `{ isError: true }` result —
 * which we then observe as a failure.
 *
 * Unconstrained on `TResult` — the SDK's CallToolResult shape is open and
 * we only need to peek at the optional `isError` flag.
 */
export function withToolTelemetry<TArgs, TResult>(
  reporter: ITelemetryReporter,
  toolName: string,
  onInvoked: () => void,
  handler: (args: TArgs) => Promise<TResult>
): (args: TArgs) => Promise<TResult> {
  return async args => {
    const startedAt = Date.now();
    let outcome: 'success' | 'error' = 'success';
    let result: TResult;
    try {
      result = await handler(args);
      if ((result as { isError?: boolean })?.isError === true) {
        outcome = 'error';
      }
      return result;
    } catch (e) {
      // Should be rare: withToolErrorHandling normally catches first. But
      // if a handler skipped that wrapper, we still record the error.
      outcome = 'error';
      reporter.trackError('tool-dispatch', e, { tool: toolName });
      throw e;
    } finally {
      const durationBucket = bucketDuration(Date.now() - startedAt);
      reporter.trackEvent('mcp.tool-invoked', {
        tool: toolName,
        durationBucket,
        outcome,
      });
      onInvoked();
    }
  };
}

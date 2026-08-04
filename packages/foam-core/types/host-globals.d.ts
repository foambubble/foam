/**
 * Minimal ambient declarations for globals that exist in every runtime
 * @foam/core targets (Node, browsers, React Native / Hermes) but are not
 * part of the ES2022 lib.
 *
 * Used only by tsconfig.portability.json to type-check the public barrel
 * without Node types. Not shipped: the main build excludes this directory,
 * so consumers keep their own (richer) global declarations.
 */

declare function setTimeout(
  callback: (...args: unknown[]) => void,
  ms?: number,
  ...args: unknown[]
): unknown;

declare function clearTimeout(handle: unknown): void;

// Node returns a Timeout object with unref(); browsers and React Native
// return a number. Callers must treat unref as optional (`timer.unref?.()`).
declare function setInterval(
  callback: (...args: unknown[]) => void,
  ms?: number,
  ...args: unknown[]
): { unref?: () => void };

declare function clearInterval(handle: unknown): void;

// performance.now() exists in Node, browsers and React Native, but is not
// part of the ES2022 lib.
declare var performance: { now(): number };

// `process` exists only on Node; host-metrics feature-detects it via
// `globalThis.process?.` (a `var` declaration is required for the global
// to be visible on `globalThis`).
declare var process:
  | {
      memoryUsage?: () => {
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
    }
  | undefined;

declare var console: {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
};

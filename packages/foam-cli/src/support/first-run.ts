import readline from 'node:readline';
import { Readable, Writable } from 'node:stream';
import { TELEMETRY_FIRST_RUN_NOTICE } from '@foam/core';

/**
 * Result of the first-run prompt:
 * - `granted` / `declined`: the user explicitly chose
 * - `no-prompt`: stdin or stdout is not a TTY, so we couldn't ask
 */
export type FirstRunPromptResult = 'granted' | 'declined' | 'no-prompt';

export interface FirstRunPromptOptions {
  /** Defaults to process.stdin. Tests inject a fake. */
  stdin?: NodeJS.ReadableStream;
  /** Defaults to process.stderr. Tests inject a sink. */
  stderr?: NodeJS.WritableStream;
  /** Defaults to (s) => s.isTTY === true on stdin and stderr. */
  isInteractive?: () => boolean;
}

const defaultIsInteractive = (): boolean =>
  Boolean(
    (process.stdin as NodeJS.ReadStream & { isTTY?: boolean }).isTTY &&
      (process.stderr as NodeJS.WriteStream & { isTTY?: boolean }).isTTY
  );

/**
 * Prints the first-run notice to stderr and reads a Y/n response from stdin.
 *
 * Returns:
 *   - `granted` for empty input (default), `y`, `yes`
 *   - `declined` for `n`, `no`
 *   - `no-prompt` if we can't safely interact (no TTY)
 *
 * The notice is printed to stderr so it doesn't pollute stdout (which may be
 * piped to a JSON consumer).
 */
export async function promptFirstRunConsent(
  options: FirstRunPromptOptions = {}
): Promise<FirstRunPromptResult> {
  const isInteractive = options.isInteractive ?? defaultIsInteractive;
  const stderr = (options.stderr ?? process.stderr) as Writable;

  if (!isInteractive()) {
    // No TTY — we can't ask, but we do a runtime disclosure by printing the notice anyway
    stderr.write(TELEMETRY_FIRST_RUN_NOTICE + '\n');
    return 'no-prompt';
  }

  const stdin = (options.stdin ?? process.stdin) as Readable;

  stderr.write(TELEMETRY_FIRST_RUN_NOTICE + '\n\nEnable telemetry? [Y/n]: ');

  const answer = await new Promise<string>(resolve => {
    const rl = readline.createInterface({ input: stdin, output: stderr, terminal: false });
    let gotLine = false;
    rl.once('line', line => {
      gotLine = true;
      rl.close();
      resolve(line);
    });
    // If stdin closes without ever giving us a line (Ctrl+D, EOF), treat
    // as empty input. Guarded so the line handler's rl.close() doesn't
    // race the close-after-resolve-line.
    rl.once('close', () => {
      if (!gotLine) resolve('');
    });
  });

  return parsePromptResponse(answer);
}

/**
 * Parses the user's answer to the consent prompt.
 *
 * Pure — exported so tests don't have to spin up a readline.
 *
 * - empty / unrecognized → `granted` (the default is on)
 * - `n`, `no` (any case, trimmed) → `declined`
 * - `y`, `yes` → `granted`
 */
export function parsePromptResponse(raw: string): 'granted' | 'declined' {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'n' || normalized === 'no') return 'declined';
  return 'granted';
}

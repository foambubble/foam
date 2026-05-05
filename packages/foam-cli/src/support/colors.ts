// Tiny zero-dep ANSI color helpers for foam-cli.
// Colors are decoration only: every helper returns the input unchanged when
// colors are disabled, so output stays scriptable in non-TTY contexts.

const RESET = '\x1b[0m';

const CODES = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  error: '\x1b[31m',
  success: '\x1b[32m',
  warning: '\x1b[33m',
  path: '\x1b[36m',
} as const;

let enabled: boolean = detectEnabled();

function detectEnabled(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '1') return true;
  return Boolean(process.stdout.isTTY);
}

export function colorsEnabled(): boolean {
  return enabled;
}

export function setColorsEnabled(value: boolean): void {
  enabled = value;
}

export function resetColorsToAutoDetect(): void {
  enabled = detectEnabled();
}

function wrap(code: string, s: string): string {
  return enabled ? `${code}${s}${RESET}` : s;
}

export const bold = (s: string) => wrap(CODES.bold, s);
export const dim = (s: string) => wrap(CODES.dim, s);
export const error = (s: string) => wrap(CODES.error, s);
export const success = (s: string) => wrap(CODES.success, s);
export const warning = (s: string) => wrap(CODES.warning, s);
export const path = (s: string) => wrap(CODES.path, s);

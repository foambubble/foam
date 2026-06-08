import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolves the directory holding Foam's user config and state files.
 *
 * Precedence:
 *   1. FOAM_CONFIG_HOME — Foam-specific escape hatch
 *   2. $XDG_CONFIG_HOME/foam — XDG spec
 *   3. $APPDATA/foam on Windows
 *   4. ~/.config/foam — default everywhere else
 *
 * Pure-ish: only reads env vars and `os.homedir()`. Does not touch disk.
 */
export function getUserConfigDir(): string {
  const foamHome = process.env.FOAM_CONFIG_HOME;
  if (foamHome && foamHome.trim() !== '') {
    return foamHome;
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim() !== '') {
    return path.join(xdg, 'foam');
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData && appData.trim() !== '') {
      return path.join(appData, 'foam');
    }
  }

  return path.join(os.homedir(), '.config', 'foam');
}

export function getUserConfigPath(): string {
  return path.join(getUserConfigDir(), 'config.json');
}

/**
 * Reads the raw on-disk config object (or `{}` if no file exists). Returns
 * the raw object so writers can round-trip unknown keys safely.
 */
export function readRawUserConfig(): Record<string, unknown> {
  const configPath = getUserConfigPath();
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

/**
 * Writes the raw config object atomically (write-then-rename). Preserves
 * any keys the caller already merged in.
 */
export function writeRawUserConfig(raw: Record<string, unknown>): void {
  const dir = getUserConfigDir();
  const configPath = getUserConfigPath();
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = configPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(raw, null, 2) + '\n');
  fs.renameSync(tmpPath, configPath);
}

/**
 * Reads `FOAM_TELEMETRY` and returns the user's opt-in/out preference.
 *
 * Recognized falsy values: `0`, `false`, `off`, `no` (case-insensitive).
 * Recognized truthy values: `1`, `true`, `on`, `yes`. Anything else (or
 * unset) returns `undefined` — "no opinion."
 *
 * Pure: only reads `process.env`.
 */
export function readEnvTelemetryOverride(): boolean | undefined {
  const raw = process.env.FOAM_TELEMETRY;
  if (raw === undefined) return undefined;

  const normalized = raw.trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  return undefined;
}

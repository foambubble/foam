import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IFoamConfigSource } from '@foam/core';

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
 * Reads the raw on-disk config object (or `{}` if no file exists). Distinct
 * from {@link readUserConfigSource}, which returns the typed `IFoamConfigSource`;
 * this returns the raw object so writers can round-trip unknown keys safely.
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
 * Reads `~/.config/foam/config.json` and returns it as a partial config
 * source. Missing file → empty source (no opinions). Invalid JSON → throws.
 *
 * The on-disk format uses flat dotted keys (VS Code-style), e.g.:
 *   { "telemetry.enabled": false }
 */
export function readUserConfigSource(): IFoamConfigSource {
  const configPath = getUserConfigPath();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw e;
  }

  return buildUserConfigSource(raw);
}

/**
 * Pure: turns a parsed config-file object into a partial config source.
 * Exported for direct testing without touching the filesystem.
 */
export function buildUserConfigSource(
  raw: Record<string, unknown>
): IFoamConfigSource {
  const source: IFoamConfigSource = {};

  const telemetryEnabled = raw['telemetry.enabled'];
  if (typeof telemetryEnabled === 'boolean') {
    source.getTelemetryEnabled = () => telemetryEnabled;
  }

  return source;
}

/**
 * Builds an `IFoamConfigSource` from `FOAM_TELEMETRY`. Recognized falsy values:
 * `0`, `false`, `off`, `no` (case-insensitive). Truthy values: `1`, `true`,
 * `on`, `yes`. Anything else is ignored (no opinion).
 *
 * Pure: only reads `process.env`.
 */
export function readEnvConfigSource(): IFoamConfigSource {
  const raw = process.env.FOAM_TELEMETRY;
  if (raw === undefined) {
    return {};
  }

  const normalized = raw.trim().toLowerCase();
  const falsy = ['0', 'false', 'off', 'no'];
  const truthy = ['1', 'true', 'on', 'yes'];

  if (falsy.includes(normalized)) {
    return { getTelemetryEnabled: () => false };
  }
  if (truthy.includes(normalized)) {
    return { getTelemetryEnabled: () => true };
  }
  return {};
}

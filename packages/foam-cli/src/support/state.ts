import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getUserConfigDir } from './user-config';

/**
 * Tool-managed state stored alongside the user config. Not user-edited.
 * Currently holds only the anonymous installation ID; future tool-managed
 * values (e.g. lastSeenVersion) can be added as additional keys.
 */
export interface FoamState {
  installationId: string;
}

export function getStatePath(): string {
  return path.join(getUserConfigDir(), 'state.json');
}

/**
 * Reads the state file. Missing file returns an empty object — the caller
 * decides how to interpret missing keys.
 */
export function readState(): Partial<FoamState> {
  const statePath = getStatePath();
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

/**
 * Writes the state file atomically (write-then-rename) so a crash mid-write
 * doesn't leave a corrupted file. Creates the config dir if needed.
 */
export function writeState(state: Partial<FoamState>): void {
  const dir = getUserConfigDir();
  const statePath = getStatePath();
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = statePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmpPath, statePath);
}

/**
 * Returns the existing installation ID, or generates and persists a new one.
 *
 * The boolean indicates whether this call *created* the ID — used by the
 * first-run flow to decide whether to prompt for consent.
 */
export function getOrCreateInstallationId(): {
  id: string;
  isNew: boolean;
} {
  const state = readState();
  if (typeof state.installationId === 'string' && state.installationId.length > 0) {
    return { id: state.installationId, isNew: false };
  }

  const id = crypto.randomUUID();
  writeState({ ...state, installationId: id });
  return { id, isNew: true };
}

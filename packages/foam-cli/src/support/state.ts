import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getUserConfigDir } from './user-config';

export interface UpdateCheckCache {
  lastChecked: string;
  latestVersion: string;
  /** ISO timestamp of the last time the update notice was shown. */
  lastNotified?: string;
}

/**
 * Tool-managed state persisted in `state.json`. Not user-edited. The
 * canonical inventory of everything the CLI persists about itself —
 * every slice's keys live here.
 */
export interface FoamState {
  installationId?: string;
  updateCheck?: UpdateCheckCache;
}

class StateStore {
  getPath(): string {
    return path.join(getUserConfigDir(), 'state.json');
  }

  read(): FoamState {
    try {
      return JSON.parse(fs.readFileSync(this.getPath(), 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw e;
    }
  }

  /**
   * Read-modify-write: merges `patch` into the current state and writes
   * atomically. Unknown keys are preserved so an older binary doesn't drop
   * state written by a newer one. Two concurrent patches to different
   * slices can race (last writer wins on what it read) — acceptable at
   * CLI scale.
   */
  patch(patch: Partial<FoamState>): void {
    const next: FoamState = { ...this.read(), ...patch };
    const statePath = this.getPath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });

    const tmpPath = statePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2) + '\n');
    fs.renameSync(tmpPath, statePath);
  }

  /**
   * Returns the existing installation ID, or generates and persists a new
   * one. `isNew` lets the caller distinguish "first run ever"
   * from "subsequent run on the same machine".
   * An empty-string ID is treated as missing — defensive against
   * partial writes from an earlier crash.
   */
  getOrCreateInstallationId(): { id: string; isNew: boolean } {
    const current = this.read().installationId;
    if (typeof current === 'string' && current.length > 0) {
      return { id: current, isNew: false };
    }
    const id = crypto.randomUUID();
    this.patch({ installationId: id });
    return { id, isNew: true };
  }

  readUpdateCheck(): UpdateCheckCache | null {
    try {
      const data = this.read().updateCheck;
      if (
        data &&
        typeof data.lastChecked === 'string' &&
        typeof data.latestVersion === 'string' &&
        (data.lastNotified === undefined || typeof data.lastNotified === 'string')
      ) {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Failures are swallowed — the update-check feature must never fail the CLI. */
  writeUpdateCheck(cache: UpdateCheckCache): void {
    try {
      this.patch({ updateCheck: cache });
    } catch {
      // non-critical
    }
  }
}

export const State = new StateStore();

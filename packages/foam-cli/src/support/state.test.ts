import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getOrCreateInstallationId,
  getStatePath,
  readState,
  writeState,
} from './state';

describe('state', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-state-'));
    process.env.FOAM_CONFIG_HOME = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns an empty state when the file is missing', () => {
    expect(readState()).toEqual({});
  });

  it('writes and reads back state', () => {
    writeState({ installationId: 'abc-123' });
    expect(readState()).toEqual({ installationId: 'abc-123' });
  });

  it('writes atomically — no .tmp lingers after a successful write', () => {
    writeState({ installationId: 'abc-123' });
    const files = fs.readdirSync(tempDir);
    expect(files).toContain('state.json');
    expect(files).not.toContain('state.json.tmp');
  });

  it('throws on invalid JSON (corruption signal)', () => {
    fs.writeFileSync(getStatePath(), '{ not valid');
    expect(() => readState()).toThrow();
  });

  describe('getOrCreateInstallationId', () => {
    it('creates a new UUID on first call and marks it new', () => {
      const result = getOrCreateInstallationId();
      expect(result.isNew).toBe(true);
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('persists the ID so subsequent calls return the same one', () => {
      const first = getOrCreateInstallationId();
      const second = getOrCreateInstallationId();

      expect(second.id).toBe(first.id);
      expect(second.isNew).toBe(false);
    });

    it('treats an empty string installationId as "needs new ID"', () => {
      writeState({ installationId: '' });
      const result = getOrCreateInstallationId();
      expect(result.isNew).toBe(true);
      expect(result.id).not.toBe('');
    });

    it('preserves other state keys when generating a new ID', () => {
      // Forward-compat: if we ever add other state fields, generating the ID
      // must not stomp on them.
      writeState({ lastSeenVersion: '1.2.3' } as never);
      getOrCreateInstallationId();
      const state = readState() as { installationId?: string; lastSeenVersion?: string };
      expect(state.lastSeenVersion).toBe('1.2.3');
      expect(state.installationId).toBeTruthy();
    });
  });
});

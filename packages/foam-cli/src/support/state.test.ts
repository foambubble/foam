import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { State } from './state';

describe('State', () => {
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

  describe('read / patch', () => {
    it('returns an empty state when the file is missing', () => {
      expect(State.read()).toEqual({});
    });

    it('patches state and reads back the merged result', () => {
      State.patch({ installationId: 'abc-123' });
      expect(State.read()).toEqual({ installationId: 'abc-123' });
    });

    it('writes atomically — no .tmp lingers after a successful patch', () => {
      State.patch({ installationId: 'abc-123' });
      const files = fs.readdirSync(tempDir);
      expect(files).toContain('state.json');
      expect(files).not.toContain('state.json.tmp');
    });

    it('throws on invalid JSON (corruption signal)', () => {
      fs.writeFileSync(State.getPath(), '{ not valid');
      expect(() => State.read()).toThrow();
    });

    it('patch merges with existing state instead of replacing', () => {
      State.patch({ installationId: 'first' });
      State.patch({
        updateCheck: { lastChecked: '2026-01-01T00:00:00.000Z', latestVersion: '0.41.0' },
      });
      const state = State.read();
      expect(state.installationId).toBe('first');
      expect(state.updateCheck?.latestVersion).toBe('0.41.0');
    });

    it('preserves unknown keys present in the on-disk file', () => {
      // Future CLI version may write a key this binary doesn't know about.
      fs.writeFileSync(
        State.getPath(),
        JSON.stringify({ futureKey: 'preserve' })
      );
      State.patch({ installationId: 'new' });
      const raw = JSON.parse(fs.readFileSync(State.getPath(), 'utf8'));
      expect(raw.futureKey).toBe('preserve');
      expect(raw.installationId).toBe('new');
    });
  });

  describe('getOrCreateInstallationId', () => {
    it('creates a new UUID on first call and marks it new', () => {
      const result = State.getOrCreateInstallationId();
      expect(result.isNew).toBe(true);
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('persists the ID so subsequent calls return the same one', () => {
      const first = State.getOrCreateInstallationId();
      const second = State.getOrCreateInstallationId();

      expect(second.id).toBe(first.id);
      expect(second.isNew).toBe(false);
    });

    it('treats an empty string installationId as "needs new ID"', () => {
      State.patch({ installationId: '' });
      const result = State.getOrCreateInstallationId();
      expect(result.isNew).toBe(true);
      expect(result.id).not.toBe('');
    });

    it('preserves other state keys when generating a new ID', () => {
      // Forward-compat: if we ever add other state fields, generating the ID
      // must not stomp on them.
      State.patch({
        updateCheck: { lastChecked: 'x', latestVersion: 'y' },
      });
      State.getOrCreateInstallationId();
      const state = State.read();
      expect(state.updateCheck?.latestVersion).toBe('y');
      expect(state.installationId).toBeTruthy();
    });
  });

});

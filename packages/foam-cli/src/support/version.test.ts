import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

// Provide __CLI_VERSION__ for tests — it's normally injected by esbuild
vi.stubGlobal('__CLI_VERSION__', '0.40.2');

// Mock https so no real network calls are made
vi.mock('https');

// Pin colors off so notice-format assertions are deterministic regardless of
// whether the test runner reports a TTY.
import { setColorsEnabled } from './colors';
setColorsEnabled(false);

import https from 'https';
import {
  getCurrentVersion,
  isNewerVersion,
  fetchLatestVersion,
  formatUpdateNotice,
  checkForUpdateNotice,
} from './version';
import { State } from './state';

// ─── getCurrentVersion ────────────────────────────────────────────────────────

describe('getCurrentVersion', () => {
  it('returns the injected version string', () => {
    expect(getCurrentVersion()).toBe('0.40.2');
  });
});

// ─── isNewerVersion ───────────────────────────────────────────────────────────

describe('isNewerVersion', () => {
  it('returns true for a patch bump', () => {
    expect(isNewerVersion('0.40.3', '0.40.2')).toBe(true);
  });

  it('returns true for a minor bump', () => {
    expect(isNewerVersion('0.41.0', '0.40.2')).toBe(true);
  });

  it('returns true for a major bump', () => {
    expect(isNewerVersion('1.0.0', '0.40.2')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('0.40.2', '0.40.2')).toBe(false);
  });

  it('returns false when candidate is older (patch)', () => {
    expect(isNewerVersion('0.40.1', '0.40.2')).toBe(false);
  });

  it('returns false when candidate is older (minor)', () => {
    expect(isNewerVersion('0.39.9', '0.40.2')).toBe(false);
  });
});

// ─── State.readUpdateCheck / State.writeUpdateCheck ───────────────────────────
describe('State.readUpdateCheck and State.writeUpdateCheck', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-version-test-'));
    process.env.FOAM_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    delete process.env.FOAM_CONFIG_HOME;
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns null when state.json does not exist', () => {
    expect(State.readUpdateCheck()).toBeNull();
  });

  it('returns null when state.json contains invalid JSON', () => {
    const statePath = path.join(tmpDir, 'state.json');
    fs.writeFileSync(statePath, '{ not valid json', 'utf8');
    expect(State.readUpdateCheck()).toBeNull();
  });

  it('returns null when state.json has no updateCheck entry', () => {
    const statePath = path.join(tmpDir, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify({ installationId: 'x' }), 'utf8');
    expect(State.readUpdateCheck()).toBeNull();
  });

  it('returns null when updateCheck has an unexpected shape', () => {
    const statePath = path.join(tmpDir, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify({ updateCheck: { foo: 'bar' } }), 'utf8');
    expect(State.readUpdateCheck()).toBeNull();
  });

  it('round-trips: writeUpdateCheckCache then readUpdateCheckCache', () => {
    const data = { lastChecked: '2026-01-01T00:00:00.000Z', latestVersion: '0.41.0' };
    State.writeUpdateCheck(data);
    expect(State.readUpdateCheck()).toEqual(data);
  });

  it('preserves other state keys (notably installationId)', () => {
    const statePath = path.join(tmpDir, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify({ installationId: 'preserve-me' }), 'utf8');
    State.writeUpdateCheck({
      lastChecked: '2026-01-01T00:00:00.000Z',
      latestVersion: '0.41.0',
    });
    const after = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(after.installationId).toBe('preserve-me');
    expect(after.updateCheck.latestVersion).toBe('0.41.0');
  });

  it('swallows write errors without throwing', () => {
    // Make state.json a directory so the atomic rename will fail.
    fs.mkdirSync(path.join(tmpDir, 'state.json'), { recursive: true });
    expect(() => State.writeUpdateCheck({ lastChecked: '', latestVersion: '' })).not.toThrow();
  });
});

// ─── fetchLatestVersion ───────────────────────────────────────────────────────

describe('fetchLatestVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockHttpsGetSuccess(body: string) {
    const { EventEmitter } = require('node:events');
    const res = new EventEmitter();
    const req = new EventEmitter() as any;
    req.socket = { unref: vi.fn() };
    req.destroy = vi.fn();
    vi.mocked(https.get).mockImplementation((_url: any, _opts: any, cb: any) => {
      cb(res);
      setTimeout(() => {
        res.emit('data', body);
        res.emit('end');
      }, 0);
      return req;
    });
  }

  function mockHttpsGetError(error: Error) {
    const { EventEmitter } = require('node:events');
    const req = new EventEmitter() as any;
    req.socket = { unref: vi.fn() };
    req.destroy = vi.fn();
    vi.mocked(https.get).mockImplementation((_url: any, _opts: any, _cb: any) => {
      setTimeout(() => req.emit('error', error), 0);
      return req;
    });
  }

  it('resolves with the version from the registry', async () => {
    mockHttpsGetSuccess(JSON.stringify({ version: '0.41.0', name: 'foam-cli' }));
    const v = await fetchLatestVersion();
    expect(v).toBe('0.41.0');
  });

  it('rejects when the registry returns JSON without a version field', async () => {
    mockHttpsGetSuccess(JSON.stringify({ name: 'foam-cli' }));
    await expect(fetchLatestVersion()).rejects.toThrow();
  });

  it('rejects when the registry returns invalid JSON', async () => {
    mockHttpsGetSuccess('not json at all');
    await expect(fetchLatestVersion()).rejects.toThrow();
  });

  it('rejects on a network error', async () => {
    mockHttpsGetError(new Error('ECONNREFUSED'));
    await expect(fetchLatestVersion()).rejects.toThrow('ECONNREFUSED');
  });
});

// ─── formatUpdateNotice ───────────────────────────────────────────────────────

describe('formatUpdateNotice', () => {
  it('includes the new version and the install command', () => {
    const notice = formatUpdateNotice('0.41.0');
    expect(notice).toContain('0.41.0');
    expect(notice).toContain('npm install -g foam-cli@latest');
  });

  it('includes the current version for context', () => {
    const notice = formatUpdateNotice('0.41.0');
    expect(notice).toContain('0.40.2');
  });
});

// ─── checkForUpdateNotice ─────────────────────────────────────────────────────

describe('checkForUpdateNotice', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-version-test-'));
    process.env.FOAM_CONFIG_HOME = tmpDir;
    // Prevent background fetch from making real network calls
    vi.mocked(https.get).mockImplementation((_url: any, _opts: any, _cb: any) => {
      const { EventEmitter } = require('node:events');
      const req = new EventEmitter() as any;
      req.socket = { unref: vi.fn() };
      req.destroy = vi.fn();
      return req;
    });
  });

  afterEach(() => {
    delete process.env.FOAM_CONFIG_HOME;
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns null when there is no cache', () => {
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns null when cache says current version is latest', () => {
    State.writeUpdateCheck({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.40.2',
    });
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns null when cache says an older version is "latest"', () => {
    State.writeUpdateCheck({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.39.0',
    });
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns a notice string when cache has a newer version and no lastNotified', () => {
    State.writeUpdateCheck({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
    });
    const notice = checkForUpdateNotice();
    expect(notice).not.toBeNull();
    expect(notice).toContain('0.41.0');
    expect(notice).toContain('npm install -g foam-cli@latest');
  });

  it('writes lastNotified after emitting the notice', () => {
    State.writeUpdateCheck({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
    });
    const before = Date.now();
    checkForUpdateNotice();
    const after = Date.now();
    const cache = State.readUpdateCheck();
    expect(cache?.lastNotified).toBeDefined();
    const notifiedMs = new Date(cache!.lastNotified!).getTime();
    expect(notifiedMs).toBeGreaterThanOrEqual(before);
    expect(notifiedMs).toBeLessThanOrEqual(after);
  });

  it('returns null when lastNotified is within the rate-limit window (24h)', () => {
    State.writeUpdateCheck({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
      // notified 1 hour ago
      lastNotified: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns a notice when lastNotified is older than the rate-limit window', () => {
    State.writeUpdateCheck({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
      // notified 25 hours ago
      lastNotified: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const notice = checkForUpdateNotice();
    expect(notice).not.toBeNull();
    expect(notice).toContain('0.41.0');
  });
});

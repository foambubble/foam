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
  readUpdateCheckCache,
  writeUpdateCheckCache,
  fetchLatestVersion,
  formatUpdateNotice,
  checkForUpdateNotice,
} from './version';

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

// ─── readUpdateCheckCache / writeUpdateCheckCache ─────────────────────────────
// These tests use the real filesystem with a temp directory. They set the
// FOAM_CACHE_DIR env var to redirect the cache path, relying on os.homedir()
// being the base for the default cache path. Instead we use a wrapper trick:
// write real files to temp dirs and call the functions using real paths by
// exercising writeUpdateCheckCache → readUpdateCheckCache round-trips.

describe('readUpdateCheckCache and writeUpdateCheckCache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-version-test-'));
    // Override HOME so getUpdateCheckCachePath() returns a path inside tmpDir
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns null when the cache file does not exist', () => {
    expect(readUpdateCheckCache()).toBeNull();
  });

  it('returns null when the cache file contains invalid JSON', () => {
    const cachePath = path.join(tmpDir, '.config', 'foam', 'update-check.json');
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, '{ not valid json', 'utf8');
    expect(readUpdateCheckCache()).toBeNull();
  });

  it('returns null when the cache file has unexpected shape', () => {
    const cachePath = path.join(tmpDir, '.config', 'foam', 'update-check.json');
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ foo: 'bar' }), 'utf8');
    expect(readUpdateCheckCache()).toBeNull();
  });

  it('round-trips: writeUpdateCheckCache then readUpdateCheckCache', () => {
    const data = { lastChecked: '2026-01-01T00:00:00.000Z', latestVersion: '0.41.0' };
    writeUpdateCheckCache(data);
    expect(readUpdateCheckCache()).toEqual(data);
  });

  it('swallows write errors without throwing', () => {
    const cachePath = path.join(tmpDir, '.config', 'foam', 'update-check.json');
    // Make the path a directory so writeFileSync will fail
    fs.mkdirSync(cachePath, { recursive: true });
    expect(() =>
      writeUpdateCheckCache({ lastChecked: '', latestVersion: '' })
    ).not.toThrow();
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
    process.env.HOME = tmpDir;
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
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns null when there is no cache', () => {
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns null when cache says current version is latest', () => {
    writeUpdateCheckCache({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.40.2',
    });
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns null when cache says an older version is "latest"', () => {
    writeUpdateCheckCache({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.39.0',
    });
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns a notice string when cache has a newer version and no lastNotified', () => {
    writeUpdateCheckCache({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
    });
    const notice = checkForUpdateNotice();
    expect(notice).not.toBeNull();
    expect(notice).toContain('0.41.0');
    expect(notice).toContain('npm install -g foam-cli@latest');
  });

  it('writes lastNotified after emitting the notice', () => {
    writeUpdateCheckCache({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
    });
    const before = Date.now();
    checkForUpdateNotice();
    const after = Date.now();
    const cache = readUpdateCheckCache();
    expect(cache?.lastNotified).toBeDefined();
    const notifiedMs = new Date(cache!.lastNotified!).getTime();
    expect(notifiedMs).toBeGreaterThanOrEqual(before);
    expect(notifiedMs).toBeLessThanOrEqual(after);
  });

  it('returns null when lastNotified is within the rate-limit window (24h)', () => {
    writeUpdateCheckCache({
      lastChecked: new Date().toISOString(),
      latestVersion: '0.41.0',
      // notified 1 hour ago
      lastNotified: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(checkForUpdateNotice()).toBeNull();
  });

  it('returns a notice when lastNotified is older than the rate-limit window', () => {
    writeUpdateCheckCache({
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

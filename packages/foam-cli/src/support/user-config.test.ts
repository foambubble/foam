import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildUserConfigSource,
  getUserConfigDir,
  getUserConfigPath,
  readEnvConfigSource,
  readUserConfigSource,
} from './user-config';

describe('getUserConfigDir', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers FOAM_CONFIG_HOME when set', () => {
    process.env.FOAM_CONFIG_HOME = '/tmp/foam-test';
    process.env.XDG_CONFIG_HOME = '/should-be-ignored';
    expect(getUserConfigDir()).toBe('/tmp/foam-test');
  });

  it('falls back to XDG_CONFIG_HOME/foam when FOAM_CONFIG_HOME is unset', () => {
    delete process.env.FOAM_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = '/tmp/xdg';
    expect(getUserConfigDir()).toBe(path.join('/tmp/xdg', 'foam'));
  });

  it('falls back to ~/.config/foam on non-Windows when no env is set', () => {
    delete process.env.FOAM_CONFIG_HOME;
    delete process.env.XDG_CONFIG_HOME;
    if (process.platform !== 'win32') {
      expect(getUserConfigDir()).toBe(path.join(os.homedir(), '.config', 'foam'));
    }
  });

  it('ignores empty / whitespace-only env values', () => {
    process.env.FOAM_CONFIG_HOME = '   ';
    process.env.XDG_CONFIG_HOME = '/tmp/xdg';
    expect(getUserConfigDir()).toBe(path.join('/tmp/xdg', 'foam'));
  });
});

describe('readUserConfigSource', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-cfg-'));
    process.env.FOAM_CONFIG_HOME = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty source when the file is missing', () => {
    const source = readUserConfigSource();
    expect(source.getTelemetryEnabled).toBeUndefined();
  });

  it('reads telemetry.enabled when set', () => {
    fs.writeFileSync(
      path.join(tempDir, 'config.json'),
      JSON.stringify({ 'telemetry.enabled': false })
    );
    const source = readUserConfigSource();
    expect(source.getTelemetryEnabled?.()).toBe(false);
  });

  it('returns no opinion when telemetry.enabled is not a boolean', () => {
    fs.writeFileSync(
      path.join(tempDir, 'config.json'),
      JSON.stringify({ 'telemetry.enabled': 'maybe' })
    );
    const source = readUserConfigSource();
    expect(source.getTelemetryEnabled).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    fs.writeFileSync(path.join(tempDir, 'config.json'), '{ not valid');
    expect(() => readUserConfigSource()).toThrow();
  });

  it('resolves the config path under the configured dir', () => {
    expect(getUserConfigPath()).toBe(path.join(tempDir, 'config.json'));
  });
});

describe('buildUserConfigSource', () => {
  it('only emits getters for known keys with valid types', () => {
    const source = buildUserConfigSource({
      'telemetry.enabled': true,
      'unrelated.key': 'ignored',
    });

    expect(source.getTelemetryEnabled?.()).toBe(true);
    // unrelated keys must not produce getters
    expect(Object.keys(source)).toEqual(['getTelemetryEnabled']);
  });
});

describe('readEnvConfigSource', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns empty source when FOAM_TELEMETRY is not set', () => {
    delete process.env.FOAM_TELEMETRY;
    expect(readEnvConfigSource()).toEqual({});
  });

  it.each(['0', 'false', 'off', 'no', 'FALSE', '  Off  '])(
    'parses %s as disabled',
    raw => {
      process.env.FOAM_TELEMETRY = raw;
      expect(readEnvConfigSource().getTelemetryEnabled?.()).toBe(false);
    }
  );

  it.each(['1', 'true', 'on', 'yes', 'TRUE'])(
    'parses %s as enabled',
    raw => {
      process.env.FOAM_TELEMETRY = raw;
      expect(readEnvConfigSource().getTelemetryEnabled?.()).toBe(true);
    }
  );

  it('ignores unrecognized values', () => {
    process.env.FOAM_TELEMETRY = 'maybe';
    expect(readEnvConfigSource()).toEqual({});
  });
});

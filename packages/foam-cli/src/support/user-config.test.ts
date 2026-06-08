import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getUserConfigDir,
  getUserConfigPath,
  readEnvTelemetryOverride,
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

describe('getUserConfigPath', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves to config.json under the configured dir', () => {
    process.env.FOAM_CONFIG_HOME = '/tmp/foam-test';
    expect(getUserConfigPath()).toBe(path.join('/tmp/foam-test', 'config.json'));
  });
});

describe('readEnvTelemetryOverride', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns undefined when FOAM_TELEMETRY is not set', () => {
    delete process.env.FOAM_TELEMETRY;
    expect(readEnvTelemetryOverride()).toBeUndefined();
  });

  it.each(['0', 'false', 'off', 'no', 'FALSE', '  Off  '])(
    'parses %s as disabled',
    raw => {
      process.env.FOAM_TELEMETRY = raw;
      expect(readEnvTelemetryOverride()).toBe(false);
    }
  );

  it.each(['1', 'true', 'on', 'yes', 'TRUE'])(
    'parses %s as enabled',
    raw => {
      process.env.FOAM_TELEMETRY = raw;
      expect(readEnvTelemetryOverride()).toBe(true);
    }
  );

  it('returns undefined for unrecognized values', () => {
    process.env.FOAM_TELEMETRY = 'maybe';
    expect(readEnvTelemetryOverride()).toBeUndefined();
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoOpLogger } from '@foam/core';
import { runConfigCommand } from './config';
import { readRawUserConfig } from '../support/user-config';

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    setLevel: vi.fn(),
    isLogLevelEnabled: () => true,
  };
}

describe('foam config', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-config-cmd-'));
    process.env.FOAM_CONFIG_HOME = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('no subcommand', () => {
    it('prints help and exits 1', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand([], logger);
      expect(code).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage: foam config')
      );
    });
  });

  describe('--help', () => {
    it('prints help and exits 0', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(['--help'], logger);
      expect(code).toBe(0);
    });
  });

  describe('unknown subcommand', () => {
    it('errors with help text', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(['nope'], logger);
      expect(code).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown subcommand "nope"')
      );
    });
  });

  describe('get', () => {
    it('reports (not set) when the key has no value yet', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(
        ['get', 'telemetry.enabled'],
        logger
      );
      expect(code).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('(not set)');
    });

    it('prints the stored boolean', async () => {
      // Seed config via set, then read back.
      await runConfigCommand(['set', 'telemetry.enabled', 'false'], new NoOpLogger());

      const logger = makeLogger();
      const code = await runConfigCommand(
        ['get', 'telemetry.enabled'],
        logger
      );
      expect(code).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('false');
    });

    it('rejects unknown keys', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(['get', 'made.up'], logger);
      expect(code).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown config key "made.up"')
      );
    });

    it('errors on missing arg', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(['get'], logger);
      expect(code).toBe(1);
    });
  });

  describe('set', () => {
    it('writes a boolean to config.json', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(
        ['set', 'telemetry.enabled', 'false'],
        logger
      );
      expect(code).toBe(0);

      const raw = readRawUserConfig();
      expect(raw['telemetry.enabled']).toBe(false);
    });

    it('accepts various boolean spellings', async () => {
      for (const truthy of ['true', '1', 'yes', 'on', 'TRUE']) {
        await runConfigCommand(
          ['set', 'telemetry.enabled', truthy],
          new NoOpLogger()
        );
        expect(readRawUserConfig()['telemetry.enabled']).toBe(true);
      }
      for (const falsy of ['false', '0', 'no', 'off', 'FALSE']) {
        await runConfigCommand(
          ['set', 'telemetry.enabled', falsy],
          new NoOpLogger()
        );
        expect(readRawUserConfig()['telemetry.enabled']).toBe(false);
      }
    });

    it('errors on invalid boolean values', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(
        ['set', 'telemetry.enabled', 'maybe'],
        logger
      );
      expect(code).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid boolean value')
      );
    });

    it('rejects unknown keys', async () => {
      const logger = makeLogger();
      const code = await runConfigCommand(
        ['set', 'made.up', 'true'],
        logger
      );
      expect(code).toBe(1);
    });

    it('preserves other keys in config.json', async () => {
      // Seed an unrelated key directly.
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ 'future.setting': 'preserve me' })
      );

      await runConfigCommand(
        ['set', 'telemetry.enabled', 'false'],
        new NoOpLogger()
      );

      const raw = readRawUserConfig();
      expect(raw['future.setting']).toBe('preserve me');
      expect(raw['telemetry.enabled']).toBe(false);
    });

    it('errors on missing args', async () => {
      const logger = makeLogger();
      expect(await runConfigCommand(['set'], logger)).toBe(1);
      expect(
        await runConfigCommand(['set', 'telemetry.enabled'], logger)
      ).toBe(1);
    });
  });
});

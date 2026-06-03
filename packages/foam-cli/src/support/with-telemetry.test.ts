import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecordingTelemetryReporter, ITelemetryReporter } from '@foam/core';
import { withTelemetry, shouldSkipTelemetry } from './with-telemetry';
import { readRawUserConfig } from './user-config';
import { State } from './state';

/**
 * Helper: wires up a Recording reporter through withTelemetry, capturing both
 * the anonymous-first-run reporter and the session reporter so we can assert
 * on what each one received.
 */
function setupReporters() {
  const anon = new RecordingTelemetryReporter();
  const session = new RecordingTelemetryReporter();
  let nextIsAnon = true;
  const reporterFactory = (installationId: string | undefined): ITelemetryReporter => {
    if (installationId === undefined) {
      nextIsAnon = false;
      return wrapWithFlush(anon);
    }
    return wrapWithFlush(session);
  };
  return { anon, session, reporterFactory, nextIsAnonRef: () => nextIsAnon };
}

function wrapWithFlush(rec: RecordingTelemetryReporter): ITelemetryReporter & {
  flush: () => Promise<number>;
} {
  return Object.assign(rec, {
    flush: async () => rec.events.length + rec.errors.length,
  });
}

describe('shouldSkipTelemetry', () => {
  it('skips the config command and undefined commands', () => {
    expect(shouldSkipTelemetry('config')).toBe(true);
    expect(shouldSkipTelemetry(undefined)).toBe(true);
    expect(shouldSkipTelemetry('graph')).toBe(false);
  });
});

describe('withTelemetry', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-wt-'));
    process.env.FOAM_CONFIG_HOME = tempDir;
    delete process.env.FOAM_TELEMETRY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('first run', () => {
    it('fires cli.first-run with consent=granted when the prompt is accepted, then fires cli.command-invoked', async () => {
      const { anon, session, reporterFactory } = setupReporters();

      const exitCode = await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'granted',
      });

      expect(exitCode).toBe(0);
      expect(anon.events).toEqual([
        { name: 'cli.first-run', properties: { consent: 'granted' } },
      ]);
      expect(session.events).toContainEqual(
        expect.objectContaining({
          name: 'cli.command-invoked',
          properties: expect.objectContaining({
            command: 'graph',
            exitCode: '0',
          }),
        })
      );
    });

    it('fires cli.first-run with consent=declined and no further events on the session reporter', async () => {
      const { anon, session, reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'declined',
      });

      expect(anon.events).toEqual([
        { name: 'cli.first-run', properties: { consent: 'declined' } },
      ]);
      // Session reporter is the Noop — our factory was only called for the
      // anonymous reporter, never for an installationId-carrying one.
      expect(session.events).toEqual([]);
    });

    it('fires cli.first-run with consent=default_on when no prompt is possible', async () => {
      const { anon, session, reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'no-prompt',
      });

      expect(anon.events).toEqual([
        { name: 'cli.first-run', properties: { consent: 'default_on' } },
      ]);
      // default_on enables telemetry → cli.command-invoked goes to the session reporter
      expect(session.events).toContainEqual(
        expect.objectContaining({ name: 'cli.command-invoked' })
      );
    });

    it('persists the user choice so the next run is a subsequent-run path', async () => {
      const { reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'declined',
      });

      expect(readRawUserConfig()['telemetry.enabled']).toBe(false);
    });

    it('creates the installation ID exactly when enabled (not on declined)', async () => {
      const { reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'declined',
      });

      // Declined: no telemetry → no installation ID needed
      expect(State.read().installationId).toBeUndefined();
    });

    it('creates the installation ID when granted', async () => {
      const { reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'granted',
      });

      expect(typeof State.read().installationId).toBe('string');
    });
  });

  describe('subsequent run', () => {
    it('does not fire cli.first-run when stored consent already exists', async () => {
      // Seed config + state to simulate a prior run.
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': true })
      );
      fs.writeFileSync(
        path.join(tempDir, 'state.json'),
        JSON.stringify({ installationId: 'existing-uuid' })
      );

      const { anon, session, reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => {
          throw new Error('should not prompt on subsequent run');
        },
      });

      expect(anon.events).toEqual([]); // no first-run event
      expect(session.events).toContainEqual(
        expect.objectContaining({ name: 'cli.command-invoked' })
      );
    });

    it('routes events through Noop when stored consent is false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );

      const { anon, session, reporterFactory } = setupReporters();

      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'granted', // ignored
      });

      expect(anon.events).toEqual([]);
      expect(session.events).toEqual([]);
    });
  });

  describe('env var override', () => {
    it('FOAM_TELEMETRY=0 disables the session reporter even when stored consent is true', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': true })
      );
      process.env.FOAM_TELEMETRY = '0';

      const { session, reporterFactory } = setupReporters();
      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
      });
      expect(session.events).toEqual([]);
    });

    it('FOAM_TELEMETRY=1 enables the session reporter even when stored consent is false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );
      process.env.FOAM_TELEMETRY = '1';

      const { session, reporterFactory } = setupReporters();
      await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
      });
      expect(session.events).toContainEqual(
        expect.objectContaining({ name: 'cli.command-invoked' })
      );
    });
  });

  describe('command lifecycle', () => {
    it('captures the command exit code', async () => {
      const { session, reporterFactory } = setupReporters();
      const exitCode = await withTelemetry({
        command: 'graph',
        run: async () => 2,
        reporterFactory,
        promptOverride: async () => 'granted',
      });

      expect(exitCode).toBe(2);
      const event = session.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties?.exitCode).toBe('2');
    });

    it('fires cli.command-invoked even when the command throws', async () => {
      const { session, reporterFactory } = setupReporters();
      await expect(
        withTelemetry({
          command: 'graph',
          run: async () => {
            throw new Error('boom');
          },
          reporterFactory,
          promptOverride: async () => 'granted',
        })
      ).rejects.toThrow('boom');

      const invokedEvent = session.events.find(
        e => e.name === 'cli.command-invoked'
      );
      expect(invokedEvent).toBeDefined();
      expect(invokedEvent?.properties?.exitCode).toBe('1');
    });

    it('attaches telemetryProperties from the result object to cli.command-invoked', async () => {
      const { session, reporterFactory } = setupReporters();
      await withTelemetry({
        command: 'note',
        run: async () => ({
          exitCode: 0,
          telemetryProperties: {
            'template-type': 'default',
            'template-format': 'md',
          },
        }),
        reporterFactory,
        promptOverride: async () => 'granted',
      });

      const event = session.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties).toMatchObject({
        command: 'note',
        exitCode: '0',
        'template-type': 'default',
        'template-format': 'md',
      });
    });

    it('still accepts a bare number return for backward compatibility', async () => {
      const { session, reporterFactory } = setupReporters();
      const exitCode = await withTelemetry({
        command: 'graph',
        run: async () => 0,
        reporterFactory,
        promptOverride: async () => 'granted',
      });
      expect(exitCode).toBe(0);
      const event = session.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties).not.toHaveProperty('template-type');
    });

    it('uses the object return exitCode for the event', async () => {
      const { session, reporterFactory } = setupReporters();
      const exitCode = await withTelemetry({
        command: 'note',
        run: async () => ({ exitCode: 2 }),
        reporterFactory,
        promptOverride: async () => 'granted',
      });
      expect(exitCode).toBe(2);
      const event = session.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties?.exitCode).toBe('2');
    });

    it('records an error event when the command throws', async () => {
      const { session, reporterFactory } = setupReporters();
      await expect(
        withTelemetry({
          command: 'graph',
          run: async () => {
            throw new TypeError('bad type');
          },
          reporterFactory,
          promptOverride: async () => 'granted',
        })
      ).rejects.toThrow();

      expect(session.errors).toContainEqual(
        expect.objectContaining({
          context: 'dispatch',
          errorType: 'TypeError',
        })
      );
    });

  });
});

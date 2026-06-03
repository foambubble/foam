import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ITelemetryReporter, InMemoryTelemetryReporter } from '@foam/core';
import { withTelemetry, shouldSkipTelemetry } from './with-telemetry';
import { readRawUserConfig } from './user-config';
import { State } from './state';

/**
 * InMemoryTelemetryReporter wrapper that captures the anonymous fork
 * `withTelemetry` creates for `cli.first-run`. Forks have independent
 * event arrays, so tests assert on `recorder.anonForks` for first-run
 * events and on `recorder.events` for the session reporter's events.
 */
class CapturingRecorder extends InMemoryTelemetryReporter {
  readonly anonForks: InMemoryTelemetryReporter[] = [];
  anonymous(): ITelemetryReporter {
    const fork = new InMemoryTelemetryReporter();
    this.anonForks.push(fork);
    return fork;
  }
}

function makeRecorder(): CapturingRecorder {
  return new CapturingRecorder();
}

/** Convenience: flatten events across the recorder and every anonymous fork. */
function allEvents(rec: CapturingRecorder) {
  return [...rec.events, ...rec.anonForks.flatMap(f => f.events)];
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
      const reporter = makeRecorder();

      const exitCode = await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'granted',
      });

      expect(exitCode).toBe(0);
      // cli.first-run lives on the anonymous fork (independent queue),
      // cli.command-invoked lives on the session reporter (the recorder itself).
      expect(reporter.anonForks[0].events).toContainEqual(
        expect.objectContaining({
          name: 'cli.first-run',
          properties: { consent: 'granted' },
        })
      );
      expect(reporter.events).toContainEqual(
        expect.objectContaining({
          name: 'cli.command-invoked',
          properties: expect.objectContaining({
            command: 'graph',
            exitCode: '0',
          }),
        })
      );
    });

    it('fires cli.first-run with consent=declined and emits nothing further', async () => {
      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'declined',
      });

      const firstRun = reporter.anonForks[0].events.filter(e => e.name === 'cli.first-run');
      expect(firstRun).toHaveLength(1);
      expect(firstRun[0].properties).toEqual({ consent: 'declined' });

      // Declined → session reporter gets nothing (no command-invoked)
      expect(allEvents(reporter).find(e => e.name === 'cli.command-invoked')).toBeUndefined();
    });

    it('fires cli.first-run with consent=default_on when no prompt is possible', async () => {
      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'no-prompt',
      });

      expect(reporter.anonForks[0].events).toContainEqual(
        expect.objectContaining({
          name: 'cli.first-run',
          properties: { consent: 'default_on' },
        })
      );
      // default_on enables telemetry → cli.command-invoked goes to the session reporter
      expect(reporter.events).toContainEqual(
        expect.objectContaining({ name: 'cli.command-invoked' })
      );
    });

    it('persists the user choice so the next run is a subsequent-run path', async () => {
      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'declined',
      });

      expect(readRawUserConfig()['telemetry.enabled']).toBe(false);
    });

    it('creates the installation ID exactly when enabled (not on declined)', async () => {
      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'declined',
      });

      // Declined: no telemetry → no installation ID needed
      expect(State.read().installationId).toBeUndefined();
    });

    it('creates the installation ID when granted', async () => {
      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
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

      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => {
          throw new Error('should not prompt on subsequent run');
        },
      });

      // Subsequent run: no anonymous fork should be created at all.
      expect(reporter.anonForks).toHaveLength(0);
      expect(reporter.events).toContainEqual(
        expect.objectContaining({ name: 'cli.command-invoked' })
      );
    });

    it('routes events through Noop when stored consent is false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );

      const reporter = makeRecorder();

      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'granted', // ignored
      });

      // Telemetry disabled → withTelemetry swaps in Noop, recorder captures nothing
      expect(reporter.events).toEqual([]);
    });
  });

  describe('env var override', () => {
    it('FOAM_TELEMETRY=0 disables the session reporter even when stored consent is true', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': true })
      );
      process.env.FOAM_TELEMETRY = '0';

      const reporter = makeRecorder();
      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
      });
      expect(reporter.events).toEqual([]);
    });

    it('FOAM_TELEMETRY=1 enables the session reporter even when stored consent is false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );
      process.env.FOAM_TELEMETRY = '1';

      const reporter = makeRecorder();
      await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
      });
      expect(reporter.events).toContainEqual(
        expect.objectContaining({ name: 'cli.command-invoked' })
      );
    });
  });

  describe('command lifecycle', () => {
    it('captures the command exit code', async () => {
      const reporter = makeRecorder();
      const exitCode = await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 2,
        promptOverride: async () => 'granted',
      });

      expect(exitCode).toBe(2);
      const event = reporter.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties?.exitCode).toBe('2');
    });

    it('fires cli.command-invoked even when the command throws', async () => {
      const reporter = makeRecorder();
      await expect(
        withTelemetry({
          command: 'graph',
          reporter,
          run: async () => {
            throw new Error('boom');
          },
          promptOverride: async () => 'granted',
        })
      ).rejects.toThrow('boom');

      const invokedEvent = reporter.events.find(e => e.name === 'cli.command-invoked');
      expect(invokedEvent).toBeDefined();
      expect(invokedEvent?.properties?.exitCode).toBe('1');
    });

    it('attaches telemetryProperties from the result object to cli.command-invoked', async () => {
      const reporter = makeRecorder();
      await withTelemetry({
        command: 'note',
        reporter,
        run: async () => ({
          exitCode: 0,
          telemetryProperties: {
            'template-type': 'default',
            'template-format': 'md',
          },
        }),
        promptOverride: async () => 'granted',
      });

      const event = reporter.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties).toMatchObject({
        command: 'note',
        exitCode: '0',
        'template-type': 'default',
        'template-format': 'md',
      });
    });

    it('still accepts a bare number return for backward compatibility', async () => {
      const reporter = makeRecorder();
      const exitCode = await withTelemetry({
        command: 'graph',
        reporter,
        run: async () => 0,
        promptOverride: async () => 'granted',
      });
      expect(exitCode).toBe(0);
      const event = reporter.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties).not.toHaveProperty('template-type');
    });

    it('uses the object return exitCode for the event', async () => {
      const reporter = makeRecorder();
      const exitCode = await withTelemetry({
        command: 'note',
        reporter,
        run: async () => ({ exitCode: 2 }),
        promptOverride: async () => 'granted',
      });
      expect(exitCode).toBe(2);
      const event = reporter.events.find(e => e.name === 'cli.command-invoked');
      expect(event?.properties?.exitCode).toBe('2');
    });

    it('records an error event when the command throws', async () => {
      const reporter = makeRecorder();
      await expect(
        withTelemetry({
          command: 'graph',
          reporter,
          run: async () => {
            throw new TypeError('bad type');
          },
          promptOverride: async () => 'granted',
        })
      ).rejects.toThrow();

      expect(reporter.errors).toContainEqual(
        expect.objectContaining({
          context: 'dispatch',
          errorType: 'TypeError',
        })
      );
    });

    it('passes the effective reporter to the run function', async () => {
      const reporter = makeRecorder();
      let received: ITelemetryReporter | undefined;
      await withTelemetry({
        command: 'graph',
        reporter,
        run: async r => {
          received = r;
          return 0;
        },
        promptOverride: async () => 'granted',
      });
      // The run callback gets the same reporter instance (telemetry was enabled).
      expect(received).toBe(reporter);
    });

    it('passes Noop to run when telemetry is disabled', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );

      const reporter = makeRecorder();
      let received: ITelemetryReporter | undefined;
      await withTelemetry({
        command: 'graph',
        reporter,
        run: async r => {
          received = r;
          return 0;
        },
      });
      // Telemetry disabled → run receives the Noop, not our recorder
      expect(received).not.toBe(reporter);
    });
  });
});

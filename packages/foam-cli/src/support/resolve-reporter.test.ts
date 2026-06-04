import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ITelemetryReporter, InMemoryTelemetryReporter, NoopTelemetryReporter } from '@foam/core';
import { resolveCliReporter } from './resolve-reporter';
import { readRawUserConfig } from './user-config';
import { State } from './state';

/**
 * Captures the anonymous fork (used for `cli.first-run`) on a recording reporter.
 */
class CapturingRecorder extends InMemoryTelemetryReporter {
  readonly anonForks: InMemoryTelemetryReporter[] = [];
  anonymous(): ITelemetryReporter {
    const fork = new InMemoryTelemetryReporter();
    this.anonForks.push(fork);
    return fork;
  }
}

function allEvents(rec: CapturingRecorder) {
  return [...rec.events, ...rec.anonForks.flatMap(f => f.events)];
}

describe('resolveCliReporter', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-rr-'));
    process.env.FOAM_CONFIG_HOME = tempDir;
    delete process.env.FOAM_TELEMETRY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('skipped commands', () => {
    it('returns Noop without prompting for the config command', async () => {
      let promptCalled = false;
      const reporter = await resolveCliReporter({
        command: 'config',
        buildReporter: () => {
          throw new Error('should not build a real reporter');
        },
        promptOverride: async () => {
          promptCalled = true;
          return 'granted';
        },
      });

      expect(reporter).toBe(NoopTelemetryReporter);
      expect(promptCalled).toBe(false);
      // No state should be touched either: this must be a true noop.
      expect(readRawUserConfig()['telemetry.enabled']).toBeUndefined();
      expect(State.read().installationId).toBeUndefined();
    });

    it('returns Noop without prompting for an undefined command', async () => {
      const reporter = await resolveCliReporter({
        command: undefined,
        buildReporter: () => {
          throw new Error('should not build');
        },
      });

      expect(reporter).toBe(NoopTelemetryReporter);
    });
  });

  describe('first run', () => {
    it('fires cli.first-run on the recorder and returns it as the effective reporter when granted', async () => {
      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => 'granted',
      });

      expect(reporter).toBe(recorder);
      expect(recorder.anonForks[0].events).toContainEqual(
        expect.objectContaining({
          name: 'cli.first-run',
          properties: { consent: 'granted' },
        })
      );
    });

    it('fires cli.first-run with consent=declined and returns Noop', async () => {
      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => 'declined',
      });

      expect(reporter).toBe(NoopTelemetryReporter);
      // The first-run event still fires (declined opt-out rate is measurable).
      expect(recorder.anonForks[0].events).toContainEqual(
        expect.objectContaining({
          name: 'cli.first-run',
          properties: { consent: 'declined' },
        })
      );
    });

    it('fires cli.first-run with consent=default_on when no prompt is possible', async () => {
      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => 'no-prompt',
      });

      expect(reporter).toBe(recorder);
      expect(recorder.anonForks[0].events).toContainEqual(
        expect.objectContaining({
          name: 'cli.first-run',
          properties: { consent: 'default_on' },
        })
      );
    });

    it('persists the user choice so the next run is a subsequent-run path', async () => {
      const recorder = new CapturingRecorder();
      await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => 'declined',
      });

      expect(readRawUserConfig()['telemetry.enabled']).toBe(false);
    });

    it('does not create the installation ID when the user declined', async () => {
      // The anonymous fork used for `cli.first-run` strips identity anyway,
      // so creating the ID would be a pointless local-state write under an
      // explicit opt-out.
      const recorder = new CapturingRecorder();
      await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => 'declined',
      });

      expect(State.read().installationId).toBeUndefined();
    });

    it('builds the reporter with an empty installationId when declined (anonymous fork strips identity anyway)', async () => {
      let receivedId: string | 'NOT_CALLED' = 'NOT_CALLED';
      await resolveCliReporter({
        command: 'graph',
        buildReporter: id => {
          receivedId = id;
          return new CapturingRecorder();
        },
        promptOverride: async () => 'declined',
      });

      // The reporter is built (to host the anonymous first-run fork) but
      // we don't create an installation ID for a run we'll discard.
      expect(receivedId).toBe('');
    });

    it('passes the installation ID to buildReporter when granted', async () => {
      const recorder = new CapturingRecorder();
      let receivedId: string | undefined;
      await resolveCliReporter({
        command: 'graph',
        buildReporter: id => {
          receivedId = id;
          return recorder;
        },
        promptOverride: async () => 'granted',
      });

      expect(typeof receivedId).toBe('string');
      expect(receivedId).toBe(State.read().installationId);
    });
  });

  describe('subsequent run', () => {
    it('does not prompt and returns the built reporter when stored consent is true', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': true })
      );

      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => {
          throw new Error('should not prompt');
        },
      });

      expect(reporter).toBe(recorder);
      // Subsequent run: no cli.first-run anywhere.
      expect(recorder.anonForks).toHaveLength(0);
    });

    it('returns Noop when stored consent is false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );

      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
      });

      expect(reporter).toBe(NoopTelemetryReporter);
    });
  });

  describe('env var override', () => {
    it('FOAM_TELEMETRY=0 on a first run skips the prompt and returns Noop', async () => {
      process.env.FOAM_TELEMETRY = '0';

      const recorder = new CapturingRecorder();
      let promptCalled = false;
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => {
          promptCalled = true;
          return 'granted';
        },
      });

      expect(promptCalled).toBe(false);
      expect(reporter).toBe(NoopTelemetryReporter);
      // Ephemeral override: nothing is persisted and no event fires, and
      // we don't leak an installation ID for a run the user opted out of.
      expect(allEvents(recorder)).toEqual([]);
      expect(readRawUserConfig()['telemetry.enabled']).toBeUndefined();
      expect(State.read().installationId).toBeUndefined();
    });

    it('FOAM_TELEMETRY=1 on a first run skips the prompt and returns the built reporter', async () => {
      process.env.FOAM_TELEMETRY = '1';

      const recorder = new CapturingRecorder();
      let promptCalled = false;
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
        promptOverride: async () => {
          promptCalled = true;
          return 'granted';
        },
      });

      expect(promptCalled).toBe(false);
      expect(reporter).toBe(recorder);
      // Still ephemeral — no persistence, no cli.first-run.
      expect(allEvents(recorder)).toEqual([]);
      expect(readRawUserConfig()['telemetry.enabled']).toBeUndefined();
    });

    it('FOAM_TELEMETRY=0 on a subsequent run with stored=true returns Noop', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': true })
      );
      process.env.FOAM_TELEMETRY = '0';

      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
      });

      expect(reporter).toBe(NoopTelemetryReporter);
    });

    it('FOAM_TELEMETRY=1 on a subsequent run with stored=false returns the built reporter', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ 'telemetry.enabled': false })
      );
      process.env.FOAM_TELEMETRY = '1';

      const recorder = new CapturingRecorder();
      const reporter = await resolveCliReporter({
        command: 'graph',
        buildReporter: () => recorder,
      });

      expect(reporter).toBe(recorder);
    });
  });
});

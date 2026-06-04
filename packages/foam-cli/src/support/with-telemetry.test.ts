import { describe, expect, it } from 'vitest';
import { ITelemetryReporter, InMemoryTelemetryReporter } from '@foam/core';
import { withTelemetry, shouldSkipTelemetry } from './with-telemetry';

describe('shouldSkipTelemetry', () => {
  it('skips the config command and undefined commands', () => {
    expect(shouldSkipTelemetry('config')).toBe(true);
    expect(shouldSkipTelemetry(undefined)).toBe(true);
    expect(shouldSkipTelemetry('graph')).toBe(false);
  });
});

describe('withTelemetry', () => {
  it('captures the command exit code', async () => {
    const reporter = new InMemoryTelemetryReporter();
    const exitCode = await withTelemetry({
      command: 'graph',
      reporter,
      run: async () => 2,
    });

    expect(exitCode).toBe(2);
    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event?.properties?.exitCode).toBe('2');
  });

  it('fires cli.command-invoked even when the command throws', async () => {
    const reporter = new InMemoryTelemetryReporter();
    await expect(
      withTelemetry({
        command: 'graph',
        reporter,
        run: async () => {
          throw new Error('boom');
        },
      })
    ).rejects.toThrow('boom');

    const invokedEvent = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(invokedEvent).toBeDefined();
    expect(invokedEvent?.properties?.exitCode).toBe('1');
  });

  it('attaches telemetryProperties from the result object to cli.command-invoked', async () => {
    const reporter = new InMemoryTelemetryReporter();
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
    const reporter = new InMemoryTelemetryReporter();
    const exitCode = await withTelemetry({
      command: 'graph',
      reporter,
      run: async () => 0,
    });
    expect(exitCode).toBe(0);
    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event?.properties).not.toHaveProperty('template-type');
  });

  it('uses the object return exitCode for the event', async () => {
    const reporter = new InMemoryTelemetryReporter();
    const exitCode = await withTelemetry({
      command: 'note',
      reporter,
      run: async () => ({ exitCode: 2 }),
    });
    expect(exitCode).toBe(2);
    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event?.properties?.exitCode).toBe('2');
  });

  it('records an error event when the command throws', async () => {
    const reporter = new InMemoryTelemetryReporter();
    await expect(
      withTelemetry({
        command: 'graph',
        reporter,
        run: async () => {
          throw new TypeError('bad type');
        },
      })
    ).rejects.toThrow();

    expect(reporter.errors).toContainEqual(
      expect.objectContaining({
        context: 'dispatch',
        errorType: 'TypeError',
      })
    );
  });

  it('passes the reporter through to the run callback', async () => {
    const reporter = new InMemoryTelemetryReporter();
    let received: ITelemetryReporter | undefined;
    await withTelemetry({
      command: 'graph',
      reporter,
      run: async r => {
        received = r;
        return 0;
      },
    });
    expect(received).toBe(reporter);
  });
});

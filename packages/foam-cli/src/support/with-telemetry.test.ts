import { describe, expect, it } from 'vitest';
import { ITelemetryReporter, InMemoryTelemetryReporter } from '@foam/core';
import { withTelemetry, shouldSkipTelemetry } from './with-telemetry';

describe('shouldSkipTelemetry', () => {
  it('skips the config command and undefined commands', () => {
    expect(shouldSkipTelemetry('config')).toBe(true);
    expect(shouldSkipTelemetry(undefined)).toBe(true);
    expect(shouldSkipTelemetry('graph')).toBe(false);
  });

  it('skips help and version invocations so a new user never hits the consent prompt on `foam --help`', () => {
    expect(shouldSkipTelemetry('help')).toBe(true);
    expect(shouldSkipTelemetry('--help')).toBe(true);
    expect(shouldSkipTelemetry('-h')).toBe(true);
    expect(shouldSkipTelemetry('--version')).toBe(true);
    expect(shouldSkipTelemetry('-v')).toBe(true);
  });

  it('skips unknown commands so typos do not become free-text telemetry events', () => {
    // The dispatcher will still print "Unknown command" — but the command
    // word is user-supplied and unbounded, so it must not flow into
    // cli.command-invoked, and a brand-new user typing a typo should not
    // see the consent prompt as their first interaction.
    expect(shouldSkipTelemetry('wibble')).toBe(true);
    expect(shouldSkipTelemetry('not-a-command')).toBe(true);
  });

  it('still runs telemetry for known commands without --help', () => {
    expect(shouldSkipTelemetry('graph')).toBe(false);
    expect(shouldSkipTelemetry('export', ['--format', 'json'])).toBe(false);
    expect(shouldSkipTelemetry('mcp', [])).toBe(false);
  });

  it('skips when --help or -h appears anywhere in the args (the command never runs)', () => {
    expect(shouldSkipTelemetry('export', ['--help'])).toBe(true);
    expect(shouldSkipTelemetry('mcp', ['--allow-writes', '--help'])).toBe(true);
    expect(shouldSkipTelemetry('lint', ['-h'])).toBe(true);
    expect(shouldSkipTelemetry('note', ['show', '--help'])).toBe(true);
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

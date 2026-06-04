import { describe, expect, it } from 'vitest';
import { InMemoryTelemetryReporter } from '@foam/core';
import { runCli } from './index';
import { TestLogger } from './test/test-utils';

/**
 * `dispatch` catches command exceptions and returns 1 so the user never sees
 * a stack trace. The risk is that telemetry loses the failure information:
 * without structured properties on `cli.command-invoked`, every failure
 * looks identical (`exitCode=1`) and the failure mode is invisible.
 *
 * These tests pin the contract: a caught command failure must surface
 * `errorType` and `errorContext` as properties of `cli.command-invoked`.
 */
describe('dispatch failure telemetry', () => {
  it('records errorType on cli.command-invoked when a command throws and dispatch catches', async () => {
    const reporter = new InMemoryTelemetryReporter();
    // `publish` without required args throws inside parsePublishCommandArgs.
    // dispatch swallows the throw and returns exit code 1.
    const exitCode = await runCli(['publish'], new TestLogger(), reporter);

    expect(exitCode).toBe(1);
    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event).toBeDefined();
    expect(event?.properties).toMatchObject({
      command: 'publish',
      exitCode: '1',
      errorType: 'Error',
    });
  });

  it('records errorContext=dispatch on the same event so the failure stage is identifiable', async () => {
    const reporter = new InMemoryTelemetryReporter();
    await runCli(['publish'], new TestLogger(), reporter);

    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event?.properties?.errorContext).toBe('dispatch');
  });

  it('successful commands do not carry errorType / errorContext', async () => {
    const reporter = new InMemoryTelemetryReporter();
    await runCli(['--version'], new TestLogger(), reporter);

    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    // --version is a fast-path return in dispatch that doesn't throw, so
    // no error metadata should appear on the event.
    expect(event?.properties).not.toHaveProperty('errorType');
    expect(event?.properties).not.toHaveProperty('errorContext');
  });
});

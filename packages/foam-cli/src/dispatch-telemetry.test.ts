import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
    // `export` without required args throws inside parseExportCommandArgs.
    // dispatch swallows the throw and returns exit code 1.
    const exitCode = await runCli(['export'], new TestLogger(), reporter);

    expect(exitCode).toBe(1);
    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event).toBeDefined();
    expect(event?.properties).toMatchObject({
      command: 'export',
      exitCode: '1',
      errorType: 'Error',
    });
  });

  it('records errorContext=dispatch on the same event so the failure stage is identifiable', async () => {
    const reporter = new InMemoryTelemetryReporter();
    await runCli(['export'], new TestLogger(), reporter);

    const event = reporter.events.find(e => e.name === 'cli.command-invoked');
    expect(event?.properties?.errorContext).toBe('dispatch');
  });

  it('does not emit cli.command-invoked for unknown commands (the command word is unbounded free text)', async () => {
    const reporter = new InMemoryTelemetryReporter();
    const exitCode = await runCli(['not-a-command'], new TestLogger(), reporter);

    // The dispatcher still prints "Unknown command" and exits 1, but no
    // telemetry event fires — typos must not flow into cli.command-invoked.
    expect(exitCode).toBe(1);
    expect(reporter.events.find(e => e.name === 'cli.command-invoked')).toBeUndefined();
  });

  it('does not emit cli.command-invoked when --help appears in the args', async () => {
    const reporter = new InMemoryTelemetryReporter();
    // `mcp --help` is recognized but prints help and returns 0 — the
    // command never runs, so we don't count it as an invocation.
    await runCli(['mcp', '--help'], new TestLogger(), reporter);

    expect(reporter.events.find(e => e.name === 'cli.command-invoked')).toBeUndefined();
  });

  it('successful commands do not carry errorType / errorContext', async () => {
    // `list templates` against an empty workspace exits 0 cleanly (the
    // command gracefully returns [] when .foam/templates is missing), so
    // it's a real successful dispatch path with no thrown errors.
    const workspace = mkdtempSync(path.join(tmpdir(), 'foam-cli-tel-'));
    try {
      const reporter = new InMemoryTelemetryReporter();
      const exitCode = await runCli(
        ['list', 'templates', '--workspace', workspace],
        new TestLogger(),
        reporter
      );

      expect(exitCode).toBe(0);
      const event = reporter.events.find(e => e.name === 'cli.command-invoked');
      expect(event).toBeDefined();
      expect(event?.properties).not.toHaveProperty('errorType');
      expect(event?.properties).not.toHaveProperty('errorContext');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

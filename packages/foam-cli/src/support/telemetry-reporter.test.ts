import { describe, expect, it, vi } from 'vitest';
import {
  AppInsightsReporter,
  type HttpPoster,
} from './telemetry-reporter';

const TEST_CONN =
  'InstrumentationKey=58799bee-3769-4118-87f7-00947bd5db7b;IngestionEndpoint=https://example.com';

function makeReporter(overrides: Partial<{
  installationId: string | undefined;
  poster: HttpPoster;
  clock: () => string;
}> = {}) {
  return new AppInsightsReporter({
    connectionString: TEST_CONN,
    component: 'cli',
    componentVersion: '0.43.0',
    coreVersion: '0.42.0',
    installationId: 'install-id-123',
    clock: () => '2026-06-03T10:00:00.000Z',
    poster:
      overrides.poster ??
      vi.fn<HttpPoster>().mockResolvedValue({ status: 200 }),
    ...overrides,
  });
}

describe('AppInsightsReporter', () => {
  it('buffers events without sending until flush is called', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.command-invoked', { command: 'graph' });
    reporter.trackEvent('cli.command-invoked', { command: 'list' });

    expect(poster).not.toHaveBeenCalled();

    const sent = await reporter.flush();
    expect(sent).toBe(2);
    expect(poster).toHaveBeenCalledOnce();
  });

  it('POSTs newline-separated envelopes to the ingestion endpoint', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.first-run', { consent: 'granted' });
    reporter.trackEvent('cli.command-invoked', { command: 'graph' });
    await reporter.flush();

    const [url, body] = poster.mock.calls[0];
    expect(url).toBe('https://example.com/v2/track');

    const lines = body.split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.data.baseData.name).toBe('cli.first-run');
    expect(first.data.baseData.properties.consent).toBe('granted');
  });

  it('attaches common Foam properties to every event', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.command-invoked', { command: 'graph' });
    await reporter.flush();

    const env = JSON.parse(poster.mock.calls[0][1]);
    expect(env.data.baseData.properties).toMatchObject({
      'foam.component': 'cli',
      'foam.version': '0.43.0',
      'foam.coreVersion': '0.42.0',
      'os.platform': process.platform,
      command: 'graph',
    });
    expect(env.data.baseData.properties['node.version']).toBe(process.version);
  });

  it('tags the envelope with the installation ID via ai.user.id', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.command-invoked');
    await reporter.flush();

    const env = JSON.parse(poster.mock.calls[0][1]);
    expect(env.tags['ai.user.id']).toBe('install-id-123');
  });

  it('omits ai.user.id when installationId is not provided (cli.first-run path)', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ installationId: undefined, poster });

    reporter.trackEvent('cli.first-run', { consent: 'declined' });
    await reporter.flush();

    const env = JSON.parse(poster.mock.calls[0][1]);
    expect(env.tags['ai.user.id']).toBeUndefined();
  });

  it('flush is a no-op when nothing is queued', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ poster });

    expect(await reporter.flush()).toBe(0);
    expect(poster).not.toHaveBeenCalled();
  });

  it('swallows network errors so telemetry never crashes the CLI', async () => {
    const poster = vi
      .fn<HttpPoster>()
      .mockRejectedValue(new Error('ECONNREFUSED'));
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.command-invoked', { command: 'graph' });
    await expect(reporter.flush()).resolves.toBe(1);
  });

  it('swallows non-2xx HTTP responses', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 503 });
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.command-invoked', { command: 'graph' });
    await expect(reporter.flush()).resolves.toBe(1);
  });

  it('clears the queue after flush — events are not sent twice', async () => {
    const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
    const reporter = makeReporter({ poster });

    reporter.trackEvent('cli.command-invoked', { command: 'graph' });
    await reporter.flush();
    await reporter.flush();

    expect(poster).toHaveBeenCalledOnce();
  });

  describe('forComponent', () => {
    it('returns an independent reporter that emits events tagged with the new component', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const cli = makeReporter({ poster });
      const mcp = cli.forComponent('mcp') as AppInsightsReporter;

      mcp.trackEvent('mcp.session-started');
      await mcp.flush();

      const env = JSON.parse(poster.mock.calls[0][1]);
      expect(env.data.baseData.properties['foam.component']).toBe('mcp');
    });

    it('forks have independent queues — flushing one does not drain the other', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const cli = makeReporter({ poster });
      const mcp = cli.forComponent('mcp') as AppInsightsReporter;

      cli.trackEvent('cli.command-invoked', { command: 'graph' });
      mcp.trackEvent('mcp.session-started');

      // Flushing the fork only sends its own event.
      const mcpSent = await mcp.flush();
      expect(mcpSent).toBe(1);
      expect(poster).toHaveBeenCalledOnce();
      const mcpEnv = JSON.parse(poster.mock.calls[0][1]);
      expect(mcpEnv.data.baseData.name).toBe('mcp.session-started');

      // The CLI event is still queued and only flushed when the parent is.
      const cliSent = await cli.flush();
      expect(cliSent).toBe(1);
      const cliEnv = JSON.parse(poster.mock.calls[1][1]);
      expect(cliEnv.data.baseData.name).toBe('cli.command-invoked');
    });

    it('preserves the installation ID on the fork', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const cli = makeReporter({ poster });
      const mcp = cli.forComponent('mcp') as AppInsightsReporter;

      mcp.trackEvent('mcp.session-started');
      await mcp.flush();

      const env = JSON.parse(poster.mock.calls[0][1]);
      expect(env.tags['ai.user.id']).toBe('install-id-123');
    });
  });

  describe('anonymous', () => {
    it('omits the installation ID tag', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const cli = makeReporter({ poster });
      const anon = cli.anonymous() as AppInsightsReporter;

      anon.trackEvent('cli.first-run', { consent: 'granted' });
      await anon.flush();

      const env = JSON.parse(poster.mock.calls[0][1]);
      expect(env.tags['ai.user.id']).toBeUndefined();
    });

    it('omits os.platform and node.version from properties', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const cli = makeReporter({ poster });
      const anon = cli.anonymous() as AppInsightsReporter;

      anon.trackEvent('cli.first-run', { consent: 'granted' });
      await anon.flush();

      const env = JSON.parse(poster.mock.calls[0][1]);
      const props = env.data.baseData.properties;
      // foam.* properties are kept (they're version info, not identity)
      expect(props['foam.component']).toBe('cli');
      expect(props['foam.version']).toBe('0.43.0');
      // identifying environment props are stripped
      expect(props['os.platform']).toBeUndefined();
      expect(props['node.version']).toBeUndefined();
      // event-specific properties pass through
      expect(props.consent).toBe('granted');
    });

    it('parent reporter still emits identifying properties on its own events', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const cli = makeReporter({ poster });
      const anon = cli.anonymous() as AppInsightsReporter;

      anon.trackEvent('cli.first-run', { consent: 'granted' });
      await anon.flush();
      const anonEnv = JSON.parse(poster.mock.calls[0][1]);
      expect(anonEnv.tags['ai.user.id']).toBeUndefined();
      expect(anonEnv.data.baseData.properties['os.platform']).toBeUndefined();

      cli.trackEvent('cli.command-invoked', { command: 'graph' });
      await cli.flush();
      const cmdEnv = JSON.parse(poster.mock.calls[1][1]);
      expect(cmdEnv.tags['ai.user.id']).toBe('install-id-123');
      expect(cmdEnv.data.baseData.properties['os.platform']).toBe(
        process.platform
      );
    });
  });

  describe('trackError', () => {
    it('emits an <component>.error event with errorType and context', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const reporter = makeReporter({ poster });

      class CustomError extends Error {}
      reporter.trackError('graph-export', new CustomError('boom'));
      await reporter.flush();

      const env = JSON.parse(poster.mock.calls[0][1]);
      expect(env.data.baseData.name).toBe('cli.error');
      expect(env.data.baseData.properties).toMatchObject({
        context: 'graph-export',
        errorType: 'CustomError',
      });
    });

    it('falls back to UnknownError for non-Error throws', async () => {
      const poster = vi.fn<HttpPoster>().mockResolvedValue({ status: 200 });
      const reporter = makeReporter({ poster });

      reporter.trackError('weird-throw', 'not an error object');
      await reporter.flush();

      const env = JSON.parse(poster.mock.calls[0][1]);
      expect(env.data.baseData.properties.errorType).toBe('UnknownError');
    });
  });
});

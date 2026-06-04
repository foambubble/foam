import { describe, expect, it } from 'vitest';
import {
  NoopTelemetryReporter,
  InMemoryTelemetryReporter,
  TELEMETRY_CONNECTION_STRING,
  buildAppInsightsEnvelope,
  bucketDuration,
  bucketNoteCount,
  decideConsent,
  parseAppInsightsConnectionString,
} from './telemetry';

describe('NoopTelemetryReporter', () => {
  it('accepts events and errors without throwing or recording anything', () => {
    expect(() => {
      NoopTelemetryReporter.trackEvent('x', { a: 'b' });
      NoopTelemetryReporter.trackError('ctx', new Error('boom'));
    }).not.toThrow();
  });
});

describe('InMemoryTelemetryReporter', () => {
  it('captures events with their properties', () => {
    const reporter = new InMemoryTelemetryReporter();
    reporter.trackEvent('a');
    reporter.trackEvent('b', { k: 'v' });

    expect(reporter.events).toEqual([
      { name: 'a', properties: undefined },
      { name: 'b', properties: { k: 'v' } },
    ]);
  });

  it('captures errors and reduces them to constructor name', () => {
    const reporter = new InMemoryTelemetryReporter();
    class CustomError extends Error {}
    reporter.trackError('ctx', new CustomError('msg'), { extra: '1' });
    reporter.trackError('ctx2', 'not-an-error');

    expect(reporter.errors).toEqual([
      { context: 'ctx', errorType: 'CustomError', properties: { extra: '1' } },
      { context: 'ctx2', errorType: 'UnknownError', properties: undefined },
    ]);
  });

  it('reset clears both events and errors', () => {
    const reporter = new InMemoryTelemetryReporter();
    reporter.trackEvent('a');
    reporter.trackError('ctx', new Error());
    reporter.reset();

    expect(reporter.events).toEqual([]);
    expect(reporter.errors).toEqual([]);
  });
});

describe('bucketNoteCount', () => {
  it.each([
    [0, '0'],
    [1, '1-10'],
    [10, '1-10'],
    [11, '11-50'],
    [50, '11-50'],
    [200, '51-200'],
    [500, '201-500'],
    [1000, '500-1000'],
    [2000, '1000-2000'],
    [5000, '2000-5000'],
    [10000, '5000-10000'],
    [10001, '10000+'],
    [1_000_000, '10000+'],
  ])('buckets %i as %s', (input, expected) => {
    expect(bucketNoteCount(input)).toBe(expected);
  });
});

describe('bucketDuration', () => {
  it.each([
    [0, '<10ms'],
    [9, '<10ms'],
    [10, '<50ms'],
    [49, '<50ms'],
    [50, '<500ms'],
    [499, '<500ms'],
    [500, '<5s'],
    [4999, '<5s'],
    [5000, '<30s'],
    [29_999, '<30s'],
    [30_000, '30s+'],
    [600_000, '30s+'],
  ])('buckets %ims as %s', (input, expected) => {
    expect(bucketDuration(input)).toBe(expected);
  });
});

describe('decideConsent', () => {
  describe('subsequent run', () => {
    it('uses the stored value when there is no env override', () => {
      expect(
        decideConsent({
          kind: 'subsequent-run',
          storedConsent: true,
          envOverride: undefined,
        })
      ).toEqual({ enabled: true, consent: undefined });

      expect(
        decideConsent({
          kind: 'subsequent-run',
          storedConsent: false,
          envOverride: undefined,
        })
      ).toEqual({ enabled: false, consent: undefined });
    });

    it('lets env override beat the stored value either way', () => {
      // Stored opt-in, env forces off
      expect(
        decideConsent({
          kind: 'subsequent-run',
          storedConsent: true,
          envOverride: false,
        })
      ).toEqual({ enabled: false, consent: undefined });

      // Stored opt-out, env forces on
      expect(
        decideConsent({
          kind: 'subsequent-run',
          storedConsent: false,
          envOverride: true,
        })
      ).toEqual({ enabled: true, consent: undefined });
    });

    it('never emits a consent value on subsequent runs (no first-run event)', () => {
      const result = decideConsent({
        kind: 'subsequent-run',
        storedConsent: true,
        envOverride: undefined,
      });
      expect(result.consent).toBeUndefined();
    });
  });

  describe('first run with prompt', () => {
    it('emits granted when the user accepted', () => {
      expect(
        decideConsent({
          kind: 'first-run-prompted',
          promptResult: 'granted',
          envOverride: undefined,
        })
      ).toEqual({ enabled: true, consent: 'granted' });
    });

    it('emits declined when the user opted out', () => {
      expect(
        decideConsent({
          kind: 'first-run-prompted',
          promptResult: 'declined',
          envOverride: undefined,
        })
      ).toEqual({ enabled: false, consent: 'declined' });
    });

    it('respects an env override on enabled, but still records what the user said', () => {
      // User declined at the prompt, but FOAM_TELEMETRY=1 forces on for this run.
      // The consent value records what the user *said*, not the override.
      expect(
        decideConsent({
          kind: 'first-run-prompted',
          promptResult: 'declined',
          envOverride: true,
        })
      ).toEqual({ enabled: true, consent: 'declined' });

      // User accepted, env forces off.
      expect(
        decideConsent({
          kind: 'first-run-prompted',
          promptResult: 'granted',
          envOverride: false,
        })
      ).toEqual({ enabled: false, consent: 'granted' });
    });
  });

  describe('first run without a prompt (non-interactive)', () => {
    it('defaults to enabled and records default_on', () => {
      expect(
        decideConsent({
          kind: 'first-run-no-prompt',
          envOverride: undefined,
        })
      ).toEqual({ enabled: true, consent: 'default_on' });
    });

    it('env override flips enabled but consent is still default_on', () => {
      expect(
        decideConsent({
          kind: 'first-run-no-prompt',
          envOverride: false,
        })
      ).toEqual({ enabled: false, consent: 'default_on' });

      expect(
        decideConsent({
          kind: 'first-run-no-prompt',
          envOverride: true,
        })
      ).toEqual({ enabled: true, consent: 'default_on' });
    });
  });

  describe('first run with env-var override (prompt skipped)', () => {
    it('honors the env var and reports no consent value to record', () => {
      // No durable user signal: `consent` must be undefined so callers
      // suppress `cli.first-run` and skip persistence.
      expect(
        decideConsent({
          kind: 'first-run-env-override',
          envOverride: false,
        })
      ).toEqual({ enabled: false, consent: undefined });

      expect(
        decideConsent({
          kind: 'first-run-env-override',
          envOverride: true,
        })
      ).toEqual({ enabled: true, consent: undefined });
    });
  });
});

describe('parseAppInsightsConnectionString', () => {
  it('parses a typical four-field connection string', () => {
    const parsed = parseAppInsightsConnectionString(
      'InstrumentationKey=abc-123;IngestionEndpoint=https://example.com/;LiveEndpoint=https://live.example.com/;ApplicationId=app-1'
    );

    expect(parsed).toEqual({
      instrumentationKey: 'abc-123',
      ingestionEndpoint: 'https://example.com',
      liveEndpoint: 'https://live.example.com',
      applicationId: 'app-1',
    });
  });

  it('strips trailing slashes on endpoints', () => {
    const parsed = parseAppInsightsConnectionString(
      'InstrumentationKey=k;IngestionEndpoint=https://x.com/;'
    );
    expect(parsed.ingestionEndpoint).toBe('https://x.com');
  });

  it('is case-insensitive on keys', () => {
    const parsed = parseAppInsightsConnectionString(
      'instrumentationkey=k;INGESTIONENDPOINT=https://x.com'
    );
    expect(parsed.instrumentationKey).toBe('k');
    expect(parsed.ingestionEndpoint).toBe('https://x.com');
  });

  it('tolerates extra whitespace and empty pairs', () => {
    const parsed = parseAppInsightsConnectionString(
      '  InstrumentationKey = k ; ; IngestionEndpoint = https://x.com ; '
    );
    expect(parsed.instrumentationKey).toBe('k');
    expect(parsed.ingestionEndpoint).toBe('https://x.com');
  });

  it('throws when InstrumentationKey is missing', () => {
    expect(() => parseAppInsightsConnectionString('IngestionEndpoint=https://x.com')).toThrow(
      /InstrumentationKey/
    );
  });

  it('throws when IngestionEndpoint is missing', () => {
    expect(() => parseAppInsightsConnectionString('InstrumentationKey=k')).toThrow(
      /IngestionEndpoint/
    );
  });

  it('parses the constant TELEMETRY_CONNECTION_STRING successfully', () => {
    // Smoke test: the value we ship must always parse.
    const parsed = parseAppInsightsConnectionString(TELEMETRY_CONNECTION_STRING);
    expect(parsed.instrumentationKey).toMatch(/^[0-9a-f-]+$/);
    expect(parsed.ingestionEndpoint).toMatch(/^https:\/\//);
  });
});

describe('buildAppInsightsEnvelope', () => {
  it('produces an EventData envelope with the expected shape', () => {
    const envelope = buildAppInsightsEnvelope({
      instrumentationKey: '58799bee-3769-4118-87f7-00947bd5db7b',
      eventName: 'cli.command-invoked',
      properties: { command: 'graph', exitCode: '0' },
      timestamp: '2026-06-03T10:00:00.000Z',
      sdkVersion: 'foam-cli:0.43.0',
      userId: 'install-uuid',
    });

    expect(envelope).toEqual({
      name: 'Microsoft.ApplicationInsights.58799bee3769411887f700947bd5db7b.Event',
      time: '2026-06-03T10:00:00.000Z',
      iKey: '58799bee-3769-4118-87f7-00947bd5db7b',
      tags: {
        'ai.internal.sdkVersion': 'foam-cli:0.43.0',
        'ai.user.id': 'install-uuid',
      },
      data: {
        baseType: 'EventData',
        baseData: {
          ver: 2,
          name: 'cli.command-invoked',
          properties: { command: 'graph', exitCode: '0' },
        },
      },
    });
  });

  it('omits sdkVersion and userId tags when not provided', () => {
    const envelope = buildAppInsightsEnvelope({
      instrumentationKey: 'k',
      eventName: 'cli.first-run',
      timestamp: '2026-06-03T10:00:00.000Z',
    });
    expect(envelope.tags).toEqual({});
  });

  it('defaults properties to an empty object', () => {
    const envelope = buildAppInsightsEnvelope({
      instrumentationKey: 'k',
      eventName: 'mcp.session-started',
      timestamp: '2026-06-03T10:00:00.000Z',
    }) as { data: { baseData: { properties: Record<string, string> } } };

    expect(envelope.data.baseData.properties).toEqual({});
  });

  it('embeds the instrumentation key with dashes stripped in the envelope name', () => {
    const envelope = buildAppInsightsEnvelope({
      instrumentationKey: 'aaa-bbb-ccc',
      eventName: 'x',
      timestamp: '2026-06-03T10:00:00.000Z',
    }) as { name: string };

    expect(envelope.name).toBe('Microsoft.ApplicationInsights.aaabbbccc.Event');
  });
});

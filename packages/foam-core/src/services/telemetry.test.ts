import { describe, expect, it } from 'vitest';
import {
  NoopTelemetryReporter,
  RecordingTelemetryReporter,
  bucketDuration,
  bucketNoteCount,
} from './telemetry';

describe('NoopTelemetryReporter', () => {
  it('accepts events and errors without throwing or recording anything', () => {
    expect(() => {
      NoopTelemetryReporter.trackEvent('x', { a: 'b' });
      NoopTelemetryReporter.trackError('ctx', new Error('boom'));
    }).not.toThrow();
  });
});

describe('RecordingTelemetryReporter', () => {
  it('captures events with their properties', () => {
    const reporter = new RecordingTelemetryReporter();
    reporter.trackEvent('a');
    reporter.trackEvent('b', { k: 'v' });

    expect(reporter.events).toEqual([
      { name: 'a', properties: undefined },
      { name: 'b', properties: { k: 'v' } },
    ]);
  });

  it('captures errors and reduces them to constructor name', () => {
    const reporter = new RecordingTelemetryReporter();
    class CustomError extends Error {}
    reporter.trackError('ctx', new CustomError('msg'), { extra: '1' });
    reporter.trackError('ctx2', 'not-an-error');

    expect(reporter.errors).toEqual([
      { context: 'ctx', errorType: 'CustomError', properties: { extra: '1' } },
      { context: 'ctx2', errorType: 'UnknownError', properties: undefined },
    ]);
  });

  it('reset clears both events and errors', () => {
    const reporter = new RecordingTelemetryReporter();
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

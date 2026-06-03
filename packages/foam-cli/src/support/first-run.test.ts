import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  parsePromptResponse,
  promptFirstRunConsent,
} from './first-run';

describe('parsePromptResponse', () => {
  it.each([
    ['', 'granted'],
    ['  ', 'granted'],
    ['y', 'granted'],
    ['Y', 'granted'],
    ['yes', 'granted'],
    ['YES', 'granted'],
    ['  Yes  ', 'granted'],
    ['anything else also defaults to on', 'granted'],
  ])('parses %j as granted (default-on)', (input, expected) => {
    expect(parsePromptResponse(input)).toBe(expected);
  });

  it.each([
    ['n', 'declined'],
    ['N', 'declined'],
    ['no', 'declined'],
    ['NO', 'declined'],
    ['  no  ', 'declined'],
  ])('parses %j as declined', (input, expected) => {
    expect(parsePromptResponse(input)).toBe(expected);
  });
});

describe('promptFirstRunConsent', () => {
  function makeStreams(input: string) {
    const stdin = new PassThrough();
    const stderr = new PassThrough();
    // Feed input on next tick so readline is set up first.
    process.nextTick(() => {
      stdin.write(input);
      stdin.end();
    });
    return { stdin, stderr };
  }

  it('returns no-prompt when isInteractive is false', async () => {
    const { stdin, stderr } = makeStreams('y\n');
    const result = await promptFirstRunConsent({
      stdin,
      stderr,
      isInteractive: () => false,
    });
    expect(result).toBe('no-prompt');
  });

  it('reads stdin and returns granted on empty answer', async () => {
    const { stdin, stderr } = makeStreams('\n');
    const result = await promptFirstRunConsent({
      stdin,
      stderr,
      isInteractive: () => true,
    });
    expect(result).toBe('granted');
  });

  it('returns declined on "n"', async () => {
    const { stdin, stderr } = makeStreams('n\n');
    const result = await promptFirstRunConsent({
      stdin,
      stderr,
      isInteractive: () => true,
    });
    expect(result).toBe('declined');
  });

  it('returns granted on "yes"', async () => {
    const { stdin, stderr } = makeStreams('yes\n');
    const result = await promptFirstRunConsent({
      stdin,
      stderr,
      isInteractive: () => true,
    });
    expect(result).toBe('granted');
  });

  it('writes the notice and the "Enable telemetry? [Y/n]: " prompt to stderr', async () => {
    const stdin = new PassThrough();
    const stderr = new PassThrough();
    const chunks: Buffer[] = [];
    stderr.on('data', c => chunks.push(c));
    stdin.end('\n');

    await promptFirstRunConsent({
      stdin,
      stderr,
      isInteractive: () => true,
    });

    const out = Buffer.concat(chunks).toString('utf8');
    expect(out).toContain('Foam collects anonymous usage data');
    expect(out).toContain('Enable telemetry? [Y/n]:');
  });

  it('treats EOF before any line as empty input (granted)', async () => {
    const stdin = new PassThrough();
    const stderr = new PassThrough();
    stdin.end(); // immediate EOF
    const result = await promptFirstRunConsent({
      stdin,
      stderr,
      isInteractive: () => true,
    });
    expect(result).toBe('granted');
  });
});

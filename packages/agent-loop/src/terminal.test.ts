import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { terminalFeedback } from './terminal.ts';

describe('terminalFeedback', () => {
  it('queues each line typed until it is taken, and hands it out once', async () => {
    const input = new PassThrough();
    const feedback = terminalFeedback(input);
    input.write('use the date helper\n\n  cover leap years  \n');
    await setImmediate();

    expect(feedback.take()).toEqual(['use the date helper', 'cover leap years']);
    expect(feedback.take()).toEqual([]);
    feedback.close();
  });
});

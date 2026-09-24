import { createInterface } from 'node:readline';
import type { Feedback } from './loop.ts';

/** Lines typed while the loop runs, queued until the next round takes them. */
export function terminalFeedback(input: NodeJS.ReadableStream): Feedback & { close(): void } {
  const waiting: string[] = [];
  const lines = createInterface({ input, terminal: false });
  lines.on('line', line => {
    const message = line.trim();
    if (message) waiting.push(message);
  });
  return {
    take: () => waiting.splice(0),
    close: () => lines.close(),
  };
}

import { afterAll } from 'vitest';
import { forceCleanup } from '../vscode-mock';

// Clean up after each test file to prevent hanging threads
afterAll(async () => {
  await forceCleanup();

  if (global.gc) {
    (global as any).gc();
  }

  await new Promise<void>(resolve => setImmediate(() => resolve()));
});

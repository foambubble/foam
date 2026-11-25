import { defineConfig } from 'vitest/config';

/**
 * UI tests: `*.ui.ts`, each driving a real VS Code window. One file at a
 * time, since each window takes the screen.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.ui.ts'],
    globalSetup: ['./src/test/ui/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
  },
});

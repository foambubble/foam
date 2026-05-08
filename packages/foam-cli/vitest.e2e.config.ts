import { defineConfig } from 'vitest/config';

/**
 * E2E config: runs *.spec.ts files. These tests spawn the built CLI as a
 * child process and exercise the full stdio transport. Requires
 * `out/index.js` to exist — `test:e2e` script builds first.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules/**', 'out/**'],
    testTimeout: 30000,
    clearMocks: true,
    reporters: process.env.CI ? ['dot'] : ['verbose'],
  },
});

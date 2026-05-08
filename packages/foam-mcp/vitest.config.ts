import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve @foam/core to TS source under vitest so the test-utils
      // subpath export shares module identity with the main entry.
      // Without this `instanceof URI` checks fail across module boundaries.
      // Order matters: longer prefix first.
      '@foam/core/test': path.join(
        __dirname,
        '../foam-core/test/test-utils.ts'
      ),
      '@foam/core': path.join(__dirname, '../foam-core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 20000,
    clearMocks: true,
    reporters: process.env.CI ? ['dot'] : ['verbose'],
  },
});

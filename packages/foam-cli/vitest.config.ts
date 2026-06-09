import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 20000,
    clearMocks: true,
    reporters: process.env.CI ? ['dot'] : ['verbose'],
  },
  define: {
    __CLI_VERSION__: JSON.stringify('0.0.0-test'),
    __CORE_VERSION__: JSON.stringify('0.0.0-test'),
  },
});

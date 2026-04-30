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
});

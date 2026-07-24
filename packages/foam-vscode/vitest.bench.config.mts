import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Config for performance benchmarks (`*.bench.ts`) in foam-vscode. Mirrors
 * foam-core's bench setup (see packages/foam-core/vitest.bench.config.ts):
 * `vitest bench` measures with tinybench and writes JSON to out/perf/; a
 * separate pure test (`perf-regression.test.ts`) reads the baseline + current
 * JSON and fails CI on a >2x regression.
 *
 * Benchmarks here must NOT depend on vscode (the mock's timing is not
 * representative). The alias is kept only so `@foam/core` resolves to source.
 */
export const PERF_DIR = 'out/perf';
export const PERF_CURRENT = `${PERF_DIR}/perf-current.json`;
export const PERF_BASELINE = `${PERF_DIR}/perf-baseline.json`;

export default defineConfig({
  resolve: {
    alias: {
      '@foam/core/test': path.join(__dirname, '../foam-core/test/test-utils.ts'),
      '@foam/core': path.join(__dirname, '../foam-core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    benchmark: {
      include: ['src/**/*.bench.ts'],
      exclude: ['node_modules/**'],
      outputJson: PERF_CURRENT,
    },
    // Benchmarks must not share a process — run serially for stable timings.
    fileParallelism: false,
  },
});

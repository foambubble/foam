import { defineConfig } from 'vitest/config';

/**
 * Config for performance benchmarks (`*.bench.ts`), run via `yarn bench` and
 * `yarn bench:update`. Kept separate from the unit config so the fast inner dev
 * loop (`test:unit`) never runs timing-sensitive code.
 *
 * `vitest bench` measures with tinybench and writes results to JSON
 * (`outputJson`). Regression enforcement is a *separate* pure test
 * (`markdown-parser.bench-compare.test.ts`) that reads the baseline and current
 * JSON and asserts — bench mode itself does not fail on regressions.
 *
 * Artifacts go under `out/perf/` (already gitignored, swept by `yarn clean`,
 * off the package root). In CI the baseline is restored there from the Actions
 * cache after the build step; see .github/workflows/ci.yml.
 */
export const PERF_DIR = 'out/perf';
export const PERF_CURRENT = `${PERF_DIR}/perf-current.json`;
export const PERF_BASELINE = `${PERF_DIR}/perf-baseline.json`;

export default defineConfig({
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

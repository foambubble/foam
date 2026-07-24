// Paths for the perf benchmark JSON, shared by the bench config
// (vitest.bench.config.ts) and the regression gate (perf-regression.test.ts).
// Kept in src/ so perf-regression.test.ts doesn't import across the tsc rootDir
// boundary into the config at the package root (see foam-core for the mirror
// setup — it can keep these inline because it excludes test files from tsc).
export const PERF_DIR = 'out/perf';
export const PERF_CURRENT = `${PERF_DIR}/perf-current.json`;
export const PERF_BASELINE = `${PERF_DIR}/perf-baseline.json`;

#!/usr/bin/env node
/**
 * Seeds the perf baseline from the latest benchmark run, but only if it does
 * not already exist. Used by CI on a cache miss (first run, or after
 * PERF_CACHE_VERSION is bumped) so there is always a baseline for the
 * comparison test to assert against on the next run.
 *
 * This is intentionally NOT part of the comparison test — the test stays a pure
 * read-and-assert. Seeding is the one filesystem side effect, kept here.
 *
 *   node scripts/seed-baseline.mjs
 *
 * Paths mirror vitest.bench.config.ts (out/perf/). A present baseline is left
 * untouched, so the baseline stays frozen until the cache key changes.
 */
import { existsSync, copyFileSync } from 'fs';

const PERF_CURRENT = 'out/perf/perf-current.json';
const PERF_BASELINE = 'out/perf/perf-baseline.json';

if (!existsSync(PERF_CURRENT)) {
  console.error(
    `No benchmark output at ${PERF_CURRENT}. Run \`yarn bench\` first.`
  );
  process.exit(1);
}

if (existsSync(PERF_BASELINE)) {
  console.log(`Baseline already present at ${PERF_BASELINE} — leaving frozen.`);
  process.exit(0);
}

copyFileSync(PERF_CURRENT, PERF_BASELINE);
console.log(`Seeded baseline ${PERF_BASELINE} from this run.`);

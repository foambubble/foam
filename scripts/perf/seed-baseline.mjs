#!/usr/bin/env node
/**
 * Seeds the perf baseline from the latest benchmark run, but only if it does not
 * already exist. Shared by every package (run from the package dir, so the
 * `out/perf/` paths resolve against that package). Used by CI on a cache miss
 * (first run, or after PERF_CACHE_VERSION is bumped) so the comparison test has
 * a baseline to assert against on the next run.
 *
 * Seeding is the one filesystem side effect — kept out of the (pure) comparison
 * test. A present baseline is left frozen until the cache key changes.
 *
 *   node ../../scripts/perf/seed-baseline.mjs
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

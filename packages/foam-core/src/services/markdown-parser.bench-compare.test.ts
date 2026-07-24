import { existsSync, readFileSync } from 'fs';
import { PERF_BASELINE, PERF_CURRENT } from '../../vitest.bench.config';

/**
 * Performance regression gate for the markdown parser (see #1375).
 *
 * This is deliberately a *pure* test: it does NOT run the benchmark. It reads
 * the JSON that `vitest bench` produced (`out/perf/perf-current.json`) and the
 * baseline that CI restores from the Actions cache
 * (`out/perf/perf-baseline.json`), and asserts one against the other.
 *
 * When either file is absent — e.g. a plain `yarn test:unit` where no benchmark
 * has run, or a first CI run before the baseline is seeded — the checks
 * self-skip. So this file is harmless in the normal unit run and only bites
 * when there is real data to compare.
 *
 * Measuring (slow, timing-sensitive) and asserting (fast, deterministic) are
 * split on purpose: `yarn bench` measures, this test evaluates.
 *
 * Thresholds (ratio = current.mean / baseline.mean), all outside the observed
 * run-to-run noise (rme ~ +/-10%):
 *   - > 2.0x  -> regression, FAIL
 *   - > 1.3x  -> drift, logged as a warning (does not fail)
 *   - < 0.5x  -> now >=2x FASTER: baseline likely stale (faster runner or a real
 *               win); logged so a runner-image upgrade can't silently hide a
 *               regression. Refresh by bumping PERF_CACHE_VERSION in CI.
 */

const FAIL_AT = 2.0;
const WARN_AT = 1.3;
const FASTER_AT = 0.5;

/** Flattens vitest bench JSON into a Map of "group::name" -> mean(ms). */
function flattenMeans(path: string): Map<string, number> {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const out = new Map<string, number>();
  for (const file of json.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const b of group.benchmarks ?? []) {
        out.set(`${group.fullName}::${b.name}`, b.mean);
      }
    }
  }
  return out;
}

const haveData = existsSync(PERF_CURRENT) && existsSync(PERF_BASELINE);

describe('Markdown parser performance regression', () => {
  if (!haveData) {
    it.skip('no benchmark data to compare (run `yarn bench` first; CI seeds the baseline)', () => {
      // Skipped: PERF_CURRENT and/or PERF_BASELINE not present.
    });
    return;
  }

  const current = flattenMeans(PERF_CURRENT);
  const baseline = flattenMeans(PERF_BASELINE);

  it('produced measurements to compare', () => {
    expect(current.size).toBeGreaterThan(0);
  });

  for (const [key, curMean] of current) {
    const baseMean = baseline.get(key);
    if (baseMean === undefined) {
      // Present now but not in the baseline (a newly added benchmark). Nothing
      // to compare — reseed the baseline (bump PERF_CACHE_VERSION) to adopt it.
      it.skip(`${key}: not in baseline (reseed to adopt)`, () => {});
      continue;
    }

    const ratio = curMean / baseMean;
    it(`${key} stays within ${FAIL_AT}x of baseline`, () => {
      if (ratio > WARN_AT && ratio <= FAIL_AT) {
        console.warn(
          `⚠️  perf drift: ${key} ${baseMean.toFixed(1)}ms -> ${curMean.toFixed(
            1
          )}ms (${ratio.toFixed(2)}x)`
        );
      }
      if (ratio < FASTER_AT) {
        console.warn(
          `⚠️  ${key} now ${(1 / ratio).toFixed(
            1
          )}x FASTER than baseline (${baseMean.toFixed(1)}ms -> ${curMean.toFixed(
            1
          )}ms) — baseline may be stale; consider bumping PERF_CACHE_VERSION.`
        );
      }
      expect(
        ratio,
        `${key}: ${baseMean.toFixed(1)}ms -> ${curMean.toFixed(
          1
        )}ms (${ratio.toFixed(2)}x). If intentional, bump PERF_CACHE_VERSION to reseed.`
      ).toBeLessThanOrEqual(FAIL_AT);
    });
  }
});

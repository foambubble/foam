import { existsSync, readFileSync } from 'fs';
import { flattenMeans, checkScaling } from './gate.mjs';

/**
 * The shared body of every package's `perf-regression.test.ts`. Call it with the
 * package's current/baseline JSON paths (from its vitest.bench.config). Both
 * checks read the SAME `perf-current.json` a single `yarn bench` produced — the
 * heavy benchmark is never run twice.
 *
 * Uses the ambient vitest globals (`describe`/`it`/`expect`) — the config has
 * `globals: true`, and this runs inside a `*.test.ts`.
 *
 * @param {{ current: string, baseline: string }} paths
 */
export function definePerfRegressionSuite({ current: PERF_CURRENT, baseline: PERF_BASELINE }) {
  const FAIL_AT = 2.0;
  const WARN_AT = 1.3;
  const FASTER_AT = 0.5;

  const haveCurrent = existsSync(PERF_CURRENT);

  describe('Performance regression', () => {
    if (!haveCurrent) {
      it.skip('no benchmark data (run `yarn bench` first)', () => {});
      return;
    }

    const currentJson = JSON.parse(readFileSync(PERF_CURRENT, 'utf8'));

    // ── Scaling (intra-run, machine-independent): asserts each [linear]/[flat]
    // series grows within its expected-complexity ceiling. Runs off the current
    // JSON alone — no baseline needed. ────────────────────────────────────────
    const scaling = checkScaling(currentJson);
    if (scaling.length === 0) {
      it.skip('no [linear]/[flat]-tagged benchmarks to scaling-check', () => {});
    }
    for (const s of scaling) {
      it(`${s.group}: ${s.from} → ${s.to} scales ${s.marker}`, () => {
        // For linear, `metric` is time-growth normalized by size-growth (≈1 when
        // linear); for flat it's the raw time ratio (≈1 when constant).
        expect(
          s.metric,
          `${s.group} ${s.from}→${s.to}: time grew ${s.timeRatio.toFixed(
            2
          )}x for a ${s.sizeRatio.toFixed(1)}x size increase ` +
            `(normalized ${s.metric.toFixed(2)}, ceiling ${s.max}) — ` +
            `likely a worse-than-${s.marker} regression.`
        ).toBeLessThanOrEqual(s.max);
      });
    }

    // ── Baseline (cross-run, machine-dependent): asserts each benchmark stays
    // within FAIL_AT of the saved baseline. Self-skips when no baseline. ───────
    if (!existsSync(PERF_BASELINE)) {
      it.skip('no baseline to compare against (CI seeds one)', () => {});
      return;
    }
    const baseline = flattenMeans(JSON.parse(readFileSync(PERF_BASELINE, 'utf8')));
    const current = flattenMeans(currentJson);

    it('produced measurements to compare', () => {
      expect(current.size).toBeGreaterThan(0);
    });

    for (const [key, curMean] of current) {
      const baseMean = baseline.get(key);
      if (baseMean === undefined) {
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
            `⚠️  ${key} now ${(1 / ratio).toFixed(1)}x FASTER than baseline — ` +
              `baseline may be stale.`
          );
        }
        expect(
          ratio,
          `${key}: ${baseMean.toFixed(1)}ms -> ${curMean.toFixed(
            1
          )}ms (${ratio.toFixed(2)}x). If intentional, reseed the baseline.`
        ).toBeLessThanOrEqual(FAIL_AT);
      });
    }
  });
}

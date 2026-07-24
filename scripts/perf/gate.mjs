/**
 * Shared performance-gate logic, used by every package's `perf-regression.test.ts`
 * (foam-core, foam-vscode, ...). Both packages produce the same `vitest bench`
 * JSON shape, so the comparison logic lives here once.
 *
 * Two independent checks run off a SINGLE bench run (the JSON already contains
 * every size's mean — nothing is measured twice):
 *
 *  1. Baseline (cross-run): current mean vs a saved baseline mean per benchmark.
 *     Catches "this commit got slower than last-known-good". Machine-DEPENDENT,
 *     so it needs a same-hardware baseline (CI restores one from cache).
 *
 *  2. Scaling (intra-run): within one run, how the mean grows as the size input
 *     grows. Catches wrong big-O (e.g. an O(n^2) creep) the moment it appears.
 *     Machine-INDEPENDENT (a ratio of same-run measurements cancels CPU speed),
 *     so it needs no baseline and runs anywhere.
 *
 * A benchmark opts into the scaling check by tagging its group title with a
 * complexity marker: `[linear]` (doubling the size ~doubles the time) or
 * `[flat]` (time ~constant as size grows). Bench names within the group must be
 * `<N> <unit>` (e.g. "2000 lines", "500 notes") so N can be parsed and the
 * series ordered.
 */

// Sizes need not be evenly spaced, so we score each consecutive pair by
// `timeRatio / sizeRatio` (how fast time grew relative to how fast size grew):
//   - ≈ 1  → linear      (time grows in step with size)
//   - ≈ sizeRatio → quadratic (much worse — the value grows with the size gap)
//   - < 1  → sub-linear  (time grows slower than size)
//   - ≈ 0  → flat/constant
//
//   - `[linear]` series: expect ≈ 1. Ceiling 1.8 absorbs constant-factor
//     overhead + noise while staying well below the ~sizeRatio an O(n^2) creep
//     produces (≥2 for our smallest 2x step, ≥5 for the 5x steps).
//   - `[flat]` series: expect ≪ 1 (sub-linear). Ceiling 1.0 passes genuinely
//     sub-linear ops (e.g. the incremental graph update, ~0.76) but fails a
//     regression to linear (≈1) or worse — which is exactly the guard that the
//     incremental path hasn't collapsed back into a full O(n) rebuild.
const LINEAR_MAX_NORMALIZED = 1.8;
const FLAT_MAX_NORMALIZED = 1.0;

/** Parse `vitest bench` JSON into groups of { fullName, marker, points }. */
export function readGroups(json) {
  const groups = [];
  for (const file of json.files ?? []) {
    for (const group of file.groups ?? []) {
      const marker = /\[(linear|flat)\]/.exec(group.fullName)?.[1];
      const points = (group.benchmarks ?? []).map(b => ({
        name: b.name,
        size: Number(/^(\d[\d_]*)/.exec(b.name)?.[1]?.replace(/_/g, '')),
        mean: b.mean,
      }));
      groups.push({ fullName: group.fullName, marker, points });
    }
  }
  return groups;
}

/** Flat map of "group::name" -> mean, for the baseline comparison. */
export function flattenMeans(json) {
  const out = new Map();
  for (const group of readGroups(json)) {
    for (const p of group.points) {
      out.set(`${group.fullName}::${p.name}`, p.mean);
    }
  }
  return out;
}

/**
 * Scaling findings for one run: for each `[linear]`/`[flat]` group, the ratio
 * between consecutive (size-ordered) points and whether it exceeds the ceiling.
 * Returns [] for groups without a marker or with fewer than 2 comparable points.
 */
export function checkScaling(json) {
  const results = [];
  for (const group of readGroups(json)) {
    if (!group.marker) {
      continue;
    }
    const isLinear = group.marker === 'linear';
    const max = isLinear ? LINEAR_MAX_NORMALIZED : FLAT_MAX_NORMALIZED;
    const points = group.points
      .filter(p => Number.isFinite(p.size) && p.mean > 0)
      .sort((a, b) => a.size - b.size);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const timeRatio = cur.mean / prev.mean;
      const sizeRatio = cur.size / prev.size;
      // Both markers score time growth normalized by size growth; only the
      // ceiling differs (linear ≈1 allowed, flat must be sub-linear <1).
      const metric = timeRatio / sizeRatio;
      results.push({
        group: group.fullName,
        marker: group.marker,
        from: prev.name,
        to: cur.name,
        timeRatio,
        sizeRatio,
        metric,
        max,
        ok: metric <= max,
      });
    }
  }
  return results;
}

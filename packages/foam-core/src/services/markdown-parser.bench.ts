import { bench } from 'vitest';
import { createMarkdownParser } from './markdown-parser';
import { ResourceParser } from '../model/note';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';
import { makeJournalNote, makeOutlineNote } from '../../test/parser-fixtures';

/**
 * Performance benchmark for the "big single note" bottleneck (see #1375 / #1689).
 *
 * While a note is being edited, its checksum changes on every keystroke, so the
 * parser cache always misses for that note. Several VS Code providers then
 * re-`parse()` the whole document independently per keystroke, so the cost of a
 * single `parse()` is what users feel as typing lag — and it grows
 * super-linearly with note size. These benchmarks track that cost.
 *
 * Run with `yarn bench` (see package.json). Regressions are enforced against a
 * baseline by the pure test `markdown-parser.bench-compare.test.ts` (fails CI at
 * 2x), NOT by an inline threshold: `vitest bench` only measures (tinybench:
 * mean/min/rme/p99) and writes JSON to out/perf/.
 *
 * These run in `test:e2e` (through `yarn bench`), not `test:unit`, to keep the
 * fast inner dev loop free of timing noise.
 *
 * ## Two shapes
 *
 * Both matter, and they behave differently. `journal` puts a heading every 25
 * lines, which ends the current list; `outline` is one unbroken nested list. The
 * current parser is near-linear on the first and quadratic on the second, so a
 * benchmark that only measured `journal` would not see the #1689 regression
 * class at all.
 *
 * ## A/B-ing a candidate parser
 *
 * To answer "is X ms OK?" the baseline alone is not enough — it only guards
 * against relative regression. The stronger move is to measure a *candidate*
 * parser against the current one on the identical corpus. Add one entry to
 * {@link parserCandidates} and run `yarn bench`: every shape/size becomes its own
 * group with one entry per candidate, so vitest prints an "N.NNx faster than"
 * comparison at that shape and size. Nothing else needs adding.
 */

Logger.setLevel('error');

const uri = URI.file('/perf/daily-note.md');

/** The note sizes we track, in lines. */
export const PARSER_BENCHMARK_SIZES = [250, 500, 1000, 2000, 4000];

/**
 * Sizes for the outline shape. Larger than {@link PARSER_BENCHMARK_SIZES}
 * because the divergence between a linear and a quadratic parser only starts to
 * show past ~4000 lines.
 *
 * Capped at 8000 to keep `yarn bench` cheap — 16000 alone costs ~14s, most of
 * the run. 8000 is enough to *detect* the regression class, but not to see how
 * bad it gets.
 *
 * **When benchmarking a second parser, add 16000 back.** The gap keeps widening
 * with size, so a comparison capped at 8000 understates it. Measured lezer vs
 * remark on this shape: 3.76x at 2000, 4.80x at 8000, 6.64x at 16000, and 25x
 * at 72000. Stopping at 8000 would have made a 25x win look like a 5x one.
 */
export const OUTLINE_BENCHMARK_SIZES = [2000, 4000, 8000];

const shapes = {
  journal: { generate: makeJournalNote, sizes: PARSER_BENCHMARK_SIZES },
  outline: { generate: makeOutlineNote, sizes: OUTLINE_BENCHMARK_SIZES },
};

interface ParserCandidate {
  /** Short label shown in the benchmark name, e.g. "current" or "lezer". */
  name: string;
  parser: ResourceParser;
}

/**
 * The parser implementations to benchmark. By default this is just the current
 * parser — a single candidate, so the committed baseline stays stable and the
 * regression gate keeps working unchanged.
 *
 * To A/B a candidate (an alternative parser, an incremental parser, an edit-time
 * cache), add it here:
 *
 *   { name: 'lezer', parser: createLezerMarkdownParser() }
 *
 * With two+ candidates the benchmark switches to per-shape/per-size groups so
 * vitest compares candidates against each other at each point. Run the A/B on
 * its own (`yarn workspace @foam/core bench`) — do NOT seed the baseline from a
 * multi-candidate run: its group/benchmark names differ from the single-parser
 * baseline the regression gate expects.
 */
const parserCandidates: ParserCandidate[] = [
  // An uncached parser on purpose: it models the edit-time case where the cache
  // never hits for the note being typed.
  { name: 'current', parser: createMarkdownParser([]) },
];

const isAB = parserCandidates.length > 1;

function benchParse(candidate: ParserCandidate, doc: string) {
  let counter = 0;
  // Append a changing suffix so nothing can short-circuit the parse.
  return () => candidate.parser.parse(uri, `${doc} ${counter++}`);
}

if (isAB) {
  // A/B mode: one group per shape and size, so vitest's "N.NNx faster than"
  // compares candidates *against each other at the same point*, not across
  // sizes.
  for (const [shape, { generate, sizes }] of Object.entries(shapes)) {
    for (const lines of sizes) {
      const doc = generate(lines);
      describe(`Markdown parser — ${shape}, ${lines} lines`, () => {
        for (const candidate of parserCandidates) {
          bench(candidate.name, benchParse(candidate, doc));
        }
      });
    }
  }
} else {
  // Single-candidate mode: flat groups with baseline-compatible names
  // ("<size> lines"), which the regression gate and committed baseline expect.
  // [linear]: doubling the note size should ~double parse time.
  describe('Markdown parser — single note parse [linear]', () => {
    for (const lines of PARSER_BENCHMARK_SIZES) {
      const doc = makeJournalNote(lines);
      bench(`${lines} lines`, benchParse(parserCandidates[0], doc));
    }
  });

  // Deliberately NOT tagged [linear]. The scaling gate asserts that time growth
  // normalized by size growth stays under a ceiling, and remark-parse really is
  // superlinear per list — it grows ~2.3-2.8x per doubling on this shape, so the
  // gate would fail on a fact we already know rather than on a regression.
  // Cross-run baseline comparison still applies. Tag it [linear] once a parser
  // that actually is linear on this shape becomes the default.
  describe('Markdown parser — unbroken outline', () => {
    for (const lines of OUTLINE_BENCHMARK_SIZES) {
      const doc = makeOutlineNote(lines);
      bench(`${lines} lines`, benchParse(parserCandidates[0], doc));
    }
  });
}

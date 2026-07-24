import { bench } from 'vitest';
import { createMarkdownParser } from './markdown-parser';
import { ResourceParser } from '../model/note';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';

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
 * ## A/B-ing a candidate parser
 *
 * To answer "is X ms OK?" the baseline alone is not enough — it only guards
 * against relative regression. The stronger move is to measure a *candidate*
 * parser against the current one on the identical corpus. Register the
 * candidate in {@link parserCandidates}: each note size then becomes its own
 * benchmark group containing one entry per candidate, so `vitest bench` prints
 * an "N.NNx faster than" comparison of the candidates *at that size*.
 */

Logger.setLevel('error');

const uri = URI.file('/perf/daily-note.md');

/**
 * Builds a note that resembles a real daily/journal note: mostly bullet lines,
 * peppered with wikilinks, reference-style links, tags and headings — the exact
 * shape reported as slow in #1375.
 */
export function makeJournalNote(lines: number): string {
  const out = ['# Daily Note', ''];
  for (let i = 0; i < lines; i++) {
    if (i % 25 === 0) {
      out.push(`## Section ${i / 25}`);
    }
    if (i % 7 === 0) {
      out.push(
        `- [${i}] worked on [[project-${i % 50}]] and [[person-${
          i % 30
        }]] #work #log`
      );
    } else if (i % 5 === 0) {
      out.push(
        `- note about [some ref][ref-${i % 40}] and https://example.com/${i}`
      );
    } else {
      out.push(
        `- line ${i}: some ordinary text content that is reasonably long to be realistic`
      );
    }
  }
  out.push('');
  for (let i = 0; i < 40; i++) {
    out.push(`[ref-${i}]: https://example.com/ref/${i}`);
  }
  return out.join('\n');
}

/** The note sizes we track, in lines. */
export const PARSER_BENCHMARK_SIZES = [250, 500, 1000, 2000, 4000];

interface ParserCandidate {
  /** Short label shown in the benchmark name, e.g. "current" or "wasm". */
  name: string;
  parser: ResourceParser;
}

/**
 * The parser implementations to benchmark. By default this is just the current
 * parser — a single candidate, so the committed baseline stays stable and the
 * regression gate keeps working unchanged.
 *
 * To A/B a candidate (e.g. markdown-wasm, an incremental parser, or an
 * edit-time cache), add it here:
 *
 *   { name: 'wasm', parser: createWasmParser() }
 *
 * With two+ candidates the benchmark switches to per-size groups so vitest
 * compares candidates against each other at each size. Run the A/B on its own
 * (`yarn workspace @foam/core bench`) — do NOT seed the baseline from a
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
  // A/B mode: one group per size so vitest's "N.NNx faster than" compares
  // candidates *against each other at the same size*, not across sizes.
  for (const lines of PARSER_BENCHMARK_SIZES) {
    const doc = makeJournalNote(lines);
    describe(`Markdown parser — ${lines} lines`, () => {
      for (const candidate of parserCandidates) {
        bench(candidate.name, benchParse(candidate, doc));
      }
    });
  }
} else {
  // Single-candidate mode: flat group with baseline-compatible names
  // ("<size> lines"), which the regression gate and committed baseline expect.
  // [linear]: doubling the note size should ~double parse time.
  describe('Markdown parser — single note parse [linear]', () => {
    for (const lines of PARSER_BENCHMARK_SIZES) {
      const doc = makeJournalNote(lines);
      bench(`${lines} lines`, benchParse(parserCandidates[0], doc));
    }
  });
}

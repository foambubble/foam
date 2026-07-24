import { bench } from 'vitest';
import { createMarkdownParser } from './markdown-parser';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';

/**
 * Performance benchmark for the "big single note" bottleneck (see #1375).
 *
 * While a note is being edited, its checksum changes on every keystroke, so the
 * parser cache always misses for that note. Several VS Code providers then
 * re-`parse()` the whole document independently per keystroke, so the cost of a
 * single `parse()` is what users feel as typing lag — and it grows
 * super-linearly with note size. These benchmarks track that cost.
 *
 * Run with `yarn bench` (see package.json). Regressions are enforced against a
 * committed baseline by `scripts/check-baseline.mjs`, not by an inline
 * threshold: `vitest bench` measures (via tinybench: mean/min/rme/p99) and
 * writes JSON; the checker compares against the baseline and fails CI at 2x.
 *
 * These run in `test:e2e` (through `yarn bench`), not `test:unit`, to keep the
 * fast inner dev loop free of timing noise.
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

describe('Markdown parser — single note parse', () => {
  // An uncached parser on purpose: it models the edit-time case where the cache
  // never hits for the note being typed.
  const parser = createMarkdownParser([]);

  for (const lines of PARSER_BENCHMARK_SIZES) {
    const doc = makeJournalNote(lines);
    let counter = 0;
    bench(`${lines} lines`, () => {
      // Append a changing suffix so nothing can short-circuit the parse.
      parser.parse(uri, `${doc} ${counter++}`);
    });
  }
});

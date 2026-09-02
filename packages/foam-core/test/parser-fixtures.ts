/**
 * Corpus generators for the parser benchmarks.
 *
 * They live here rather than next to the benchmarks because importing a
 * `*.bench.ts` file re-runs its top-level `bench()` registrations in the
 * importer's context, reporting the same benchmarks twice under two file names.
 * Keeping the fixtures in a plain module lets a second bench file — say one
 * comparing an alternative parser — reuse them.
 */

/**
 * A note that resembles a real daily/journal note: mostly bullet lines,
 * peppered with wikilinks, reference-style links, tags and headings — the shape
 * reported as slow in #1375.
 *
 * Note the heading every 25 lines: it ends the current list, so this shape
 * stays near-linear even in a parser that is superlinear per list. Use
 * {@link makeOutlineNote} for that.
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

/**
 * A note that is one unbroken outline — no headings to split the list up, and
 * nested a few levels deep.
 *
 * This is the shape from #1689: `remark-parse` is superlinear in the size of a
 * single list, so the same number of lines costs far more as one long outline
 * than split into many small lists. Measured with the current parser, the two
 * shapes diverge sharply past ~8000 lines.
 */
export function makeOutlineNote(lines: number): string {
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    out.push(`${'  '.repeat(i % 4)}- line ${i}: ordinary journal text here`);
  }
  return out.join('\n');
}

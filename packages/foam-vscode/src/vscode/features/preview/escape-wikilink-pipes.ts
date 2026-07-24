/*global markdownit:readonly*/

/**
 * Markdown-it plugin to handle wikilink aliases in tables.
 *
 * This plugin addresses issue #1544 where wikilink aliases (e.g., [[note|alias]])
 * are incorrectly split into separate table cells because the pipe character `|`
 * is used both as a wikilink alias separator and a table column separator.
 *
 * It works in two document-wide passes, run once per render via `core.ruler`:
 * 1. **encode** (before block parsing): replace pipes inside wikilinks with a
 *    placeholder in the whole source, so the table parser never splits a
 *    wikilink into separate cells.
 * 2. **decode** (after inline parsing): restore the pipes in every inline token,
 *    so the rendered output shows the original `[[note|alias]]`.
 *
 * Doing this ONCE per render (not inside the per-line table rule) is essential:
 * markdown-it invokes block rules as candidates on many lines, so re-scanning
 * the whole source inside the table rule was O(lines × docSize) and froze the
 * preview on large notes (#1689).
 */

// Unique placeholder that's unlikely to appear in normal markdown text
// Note: We've tested various text-based placeholders but all fail:
// - "___FOAM_ALIAS_DIVIDER___" - underscores interpreted as emphasis markers
// - "FOAM__INTERNAL__..." - double underscores cause strong emphasis issues
// - "FOAMINTERNALALIASDIVIDERPLACEHOLDER" - gets truncated (output: "[[noteFOAMINTERN")
// Solution: Use a single Unicode character (U+F8FF Private Use Area) that:
// - Has no markdown meaning
// - Won't be split or modified by parsers
// - Is extremely unlikely to appear in user content
export const PIPE_PLACEHOLDER = '\uF8FF';

/**
 * Regex to match wikilinks (and embeds) with at least one pipe.
 *
 * `[^\]|]*` (greedy, no `|`) for each segment avoids the catastrophic
 * backtracking the previous `[^\]]*?\|[^\]]*?` had on unclosed `[[` with many
 * pipes: each character belongs to exactly one segment, so there is nothing to
 * backtrack. `(?:\|[^\]|]*)+` allows any number of pipe-separated segments.
 */
const WIKILINK_WITH_PIPE_REGEX = /!?\[\[[^\]|]*(?:\|[^\]|]*)+\]\]/g;

/** Replace pipes within wikilinks with the placeholder, across `text`. */
function encodePipesInWikilinks(text: string): string {
  // Cheap guard: nothing to do (and no regex work) when there are no pipes.
  if (!text.includes('|')) {
    return text;
  }
  return text.replace(WIKILINK_WITH_PIPE_REGEX, match =>
    match.replace(/\|/g, PIPE_PLACEHOLDER)
  );
}

/** Restore pipes from the placeholder in `text`. */
function decodePipesInWikilinks(text: string): string {
  if (!text.includes(PIPE_PLACEHOLDER)) {
    return text;
  }
  return text.split(PIPE_PLACEHOLDER).join('|');
}

export const escapeWikilinkPipes = (md: markdownit) => {
  // ENCODE once, before block parsing sees the source. The table parser then
  // never splits a piped wikilink across cells. O(docSize), once per render.
  md.core.ruler.before('block', 'foam_encode_wikilink_pipes', state => {
    state.src = encodePipesInWikilinks(state.src);
    return false;
  });

  // DECODE once, AFTER block parsing (the table structure is fixed) but BEFORE
  // inline parsing. This restores real pipes in each inline token's raw content
  // so the other Foam inline plugins (wikilink embed/navigation) see
  // `[[note|alias]]`, not the placeholder — while the already-built table cells
  // stay intact. Doing it here rather than after `inline` is what keeps aliases
  // working outside tables too.
  md.core.ruler.after('block', 'foam_decode_wikilink_pipes', state => {
    for (const token of state.tokens) {
      if (token.type === 'inline' && token.content) {
        token.content = decodePipesInWikilinks(token.content);
      }
    }
    return false;
  });

  return md;
};

export default escapeWikilinkPipes;

/*global markdownit:readonly*/

/**
 * markdown-it plugin that adds HTML `id` attributes to block elements
 * carrying a `^blockid` anchor marker.
 *
 * This enables in-preview fragment navigation: clicking `[[note#^myblock]]`
 * in the preview scrolls directly to the target block.
 *
 * Two syntaxes are handled:
 *
 * 1. Inline marker — `^id` at the end of the block's own line:
 *    `Some text ^myblock`
 *    `- List item ^myblock`
 *    The id is set on the opening HTML element (paragraph, list item, etc.).
 *    For headings a separate `<a id>` anchor is inserted before the heading tag
 *    to preserve the auto-generated slug id used by section links.
 *
 * 2. Full-line marker — `^id` on its own line immediately after the block:
 *    ```
 *    code
 *    ```
 *    ^mycode
 *
 *    | table |
 *    ^mytable
 *
 *    - item 1
 *    - item 2
 *    ^mylist
 *
 *    For code fences the standalone `^id` paragraph is removed and an anchor
 *    is inserted before the fence.  For tables markdown-it absorbs the `^id`
 *    as a table row, so we detect and remove that row and anchor the table.
 *    For lists the `^id` is absorbed into the last item's inline content
 *    (as `"last item text\n^id"`); we strip it and anchor the list element.
 *
 * The `__` prefix on ids minimises collisions with section-based ids and
 * avoids the `^` character which is not a valid CSS identifier character.
 * The ` ^blockid` marker is stripped from the visible rendered text.
 */

// Matches a trailing inline block anchor: ` ^blockid` at end of content.
const INLINE_ANCHOR_RE = /\s\^([a-zA-Z0-9-]+)$/;
// Matches a standalone full-line block anchor paragraph: only `^blockid`.
const FULL_LINE_ANCHOR_RE = /^\^([a-zA-Z0-9-]+)$/;
// Matches a trailing own-line block anchor inside multiline inline content.
const TRAILING_OWN_LINE_ANCHOR_RE = /\n\^([a-zA-Z0-9-]+)$/;

/** Insert an `<a id>` anchor token before position `idx`. */
function insertAnchor(
  state: any,
  tokens: any[],
  idx: number,
  blockId: string
): void {
  const anchor = new state.Token('html_block', '', 0);
  anchor.content = `<a id="__${blockId}" aria-hidden="true"></a>\n`;
  tokens.splice(idx, 0, anchor);
}

/**
 * Walk backward from `startIdx` to find the nearest open token of one of the
 * given types, accounting for nesting depth.
 */
function findMatchingOpen(
  tokens: any[],
  startIdx: number,
  openType: string,
  closeType: string
): number {
  let depth = 0;
  for (let j = startIdx; j >= 0; j--) {
    if (tokens[j].type === closeType) {
      depth++;
    } else if (tokens[j].type === openType) {
      if (depth === 0) {
        return j;
      }
      depth--;
    }
  }
  return -1;
}

export const markdownItBlockAnchorIds = (md: markdownit) => {
  md.core.ruler.push('block-anchor-ids', state => {
    const tokens = state.tokens;

    // ── Pass 1: inline markers ──────────────────────────────────────────────
    // Iterate in reverse so splice insertions don't affect unvisited indices.
    for (let i = tokens.length - 1; i >= 1; i--) {
      const token = tokens[i];
      if (token.type !== 'inline') {
        continue;
      }

      // Skip tokens whose content is ONLY a full-line anchor — those are
      // handled by Pass 2 below (code/table) or Pass 3 (list/blockquote).
      if (FULL_LINE_ANCHOR_RE.test(token.content)) {
        continue;
      }

      // Skip tokens whose content ends with a own-line anchor (`\n^id`).
      // These are absorbed list full-line IDs; Pass 3 handles them.
      if (TRAILING_OWN_LINE_ANCHOR_RE.test(token.content)) {
        continue;
      }

      const match = token.content.match(INLINE_ANCHOR_RE);
      if (!match) {
        continue;
      }

      const blockId = match[1];
      let openToken = tokens[i - 1];

      // Only act when the preceding token is a block-level opening tag.
      if (!openToken || openToken.nesting !== 1) {
        continue;
      }

      // A paragraph_open inside a tight list item is rendered with hidden=true
      // (no <p> tag is emitted), so any attribute set on it would be lost.
      // Walk back to find the enclosing list_item_open instead.
      if (openToken.hidden) {
        let found = false;
        for (let j = i - 2; j >= 0; j--) {
          if (tokens[j].nesting === 1 && !tokens[j].hidden) {
            openToken = tokens[j];
            found = true;
            break;
          }
        }
        if (!found) {
          continue;
        }
      }

      if (openToken.type === 'heading_open') {
        // Insert a standalone anchor before the heading so we don't overwrite
        // the heading's auto-generated slug id (used by [[note#Section]] links).
        insertAnchor(state, tokens, i - 1, blockId);
        // i - 1 was just used for the heading_open; after splice all indices
        // >= i-1 shift by +1, but since we iterate in reverse this is fine.
      } else {
        openToken.attrSet('id', `__${blockId}`);
      }

      // Strip the ^id marker from the rendered inline children.
      if (token.children) {
        for (let k = token.children.length - 1; k >= 0; k--) {
          const child = token.children[k];
          if (child.type === 'text') {
            const stripped = child.content.replace(INLINE_ANCHOR_RE, '');
            if (stripped !== child.content) {
              child.content = stripped;
              token.content = token.content.replace(INLINE_ANCHOR_RE, '');
              break;
            }
          }
        }
      }
    }

    // ── Pass 2: full-line anchor paragraph after a fence or table ─────────
    // Handles the case where `^id` is a standalone paragraph following a fence
    // or a table. With no blank line, tables absorb `^id` as a row (Pass 3);
    // with a blank line, `^id` becomes a standalone paragraph caught here.
    // One blank line between the block and `^id` is tolerated so that markdown
    // formatters that insert blank lines around code/table blocks still work.
    for (let i = tokens.length - 1; i >= 2; i--) {
      const token = tokens[i];
      if (token.type !== 'inline') {
        continue;
      }
      const idMatch = token.content.match(FULL_LINE_ANCHOR_RE);
      if (!idMatch) {
        continue;
      }
      // Must be wrapped in a paragraph: paragraph_open at i-1.
      if (tokens[i - 1]?.type !== 'paragraph_open') {
        continue;
      }
      // paragraph_close must follow at i+1.
      if (tokens[i + 1]?.type !== 'paragraph_close') {
        continue;
      }

      const prevToken = tokens[i - 2];
      const paraStart = tokens[i - 1].map?.[0];
      let anchorBeforeIdx = -1;

      if (prevToken?.type === 'fence') {
        // Allow up to one blank line between the fence and the ^id paragraph.
        const fenceEnd = prevToken.map?.[1];
        if (
          fenceEnd !== undefined &&
          paraStart !== undefined &&
          paraStart > fenceEnd + 1
        ) {
          continue;
        }
        anchorBeforeIdx = i - 2;
      } else if (prevToken?.type === 'table_close') {
        // ^id as standalone paragraph after a table (blank-line case).
        const tableOpenIdx = findMatchingOpen(
          tokens,
          i - 3,
          'table_open',
          'table_close'
        );
        if (tableOpenIdx === -1) {
          continue;
        }
        // Allow up to one blank line.
        const tableEnd = tokens[tableOpenIdx].map?.[1];
        if (
          tableEnd !== undefined &&
          paraStart !== undefined &&
          paraStart > tableEnd + 1
        ) {
          continue;
        }
        anchorBeforeIdx = tableOpenIdx;
      }

      if (anchorBeforeIdx === -1) {
        continue;
      }

      const blockId = idMatch[1];
      // insertAnchor shifts all tokens at indices >= anchorBeforeIdx up by 1,
      // so the paragraph_open is now at i, inline at i+1, paragraph_close at i+2.
      insertAnchor(state, tokens, anchorBeforeIdx, blockId);
      tokens.splice(i, 3);
      i -= 2;
    }

    // ── Pass 3: full-line anchor absorbed into table or list ───────────────
    // For tables: markdown-it parses the `^id` line as a table row, placing
    // the anchor text in the first <td>. We detect this, remove the row, and
    // anchor the table.
    // For lists: the `^id` appears as `"last item\n^id"` in the last item's
    // inline token. We strip it and anchor the surrounding list element.
    for (let i = tokens.length - 1; i >= 1; i--) {
      const token = tokens[i];
      if (token.type !== 'inline') {
        continue;
      }

      // Table case: inline content is only "^id" and is inside a td_open.
      const tableIdMatch = token.content.match(FULL_LINE_ANCHOR_RE);
      if (tableIdMatch && tokens[i - 1]?.type === 'td_open') {
        const blockId = tableIdMatch[1];

        // Find the tr_open that starts the row containing this td.
        const trOpenIdx = findMatchingOpen(
          tokens,
          i - 1,
          'tr_open',
          'tr_close'
        );
        if (trOpenIdx === -1) {
          continue;
        }

        // Find the tr_close that ends this row.
        let trCloseIdx = -1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'tr_close') {
            trCloseIdx = j;
            break;
          }
        }
        if (trCloseIdx === -1) {
          continue;
        }

        // Find table_open to insert anchor before it.
        const tableOpenIdx = findMatchingOpen(
          tokens,
          trOpenIdx - 1,
          'table_open',
          'table_close'
        );
        if (tableOpenIdx === -1) {
          continue;
        }

        // Remove the row (tr_open … tr_close inclusive) — work from the end.
        tokens.splice(trOpenIdx, trCloseIdx - trOpenIdx + 1);
        // Insert anchor before table_open (index unchanged since we removed after it).
        insertAnchor(state, tokens, tableOpenIdx, blockId);
        // Adjust i to account for removals.
        i = trOpenIdx - 1;
        continue;
      }

      // List case: inline content ends with "\n^id" (own-line anchor in last item).
      const listIdMatch = token.content.match(TRAILING_OWN_LINE_ANCHOR_RE);
      if (listIdMatch) {
        const blockId = listIdMatch[1];

        // Find the enclosing list open (bullet or ordered).
        let listOpenIdx = -1;
        let listOpenType = '';
        for (let j = i - 1; j >= 0; j--) {
          if (
            tokens[j].type === 'bullet_list_open' ||
            tokens[j].type === 'ordered_list_open'
          ) {
            listOpenIdx = j;
            listOpenType = tokens[j].type;
            break;
          }
        }
        if (listOpenIdx === -1) {
          continue;
        }

        // Find the matching list close to confirm this is the outermost list.
        const listCloseType =
          listOpenType === 'bullet_list_open'
            ? 'bullet_list_close'
            : 'ordered_list_close';
        let listCloseIdx = -1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === listCloseType) {
            listCloseIdx = j;
            break;
          }
        }
        if (listCloseIdx === -1) {
          continue;
        }

        // Set the id on the list_open token.
        tokens[listOpenIdx].attrSet('id', `__${blockId}`);

        // Strip "\n^id" from the inline content and children.
        // The \n is a softbreak child token and ^id is a separate text child,
        // so we search for the text("^id") child and remove it + the preceding break.
        token.content = token.content.replace(TRAILING_OWN_LINE_ANCHOR_RE, '');
        if (token.children) {
          for (let k = token.children.length - 1; k >= 0; k--) {
            const child = token.children[k];
            if (child.type === 'text') {
              // Case A: the \n^id is embedded in the text value itself.
              const stripped = child.content.replace(
                TRAILING_OWN_LINE_ANCHOR_RE,
                ''
              );
              if (stripped !== child.content) {
                child.content = stripped;
                break;
              }
              // Case B: text child is just "^id" (no leading whitespace) with
              // a softbreak/hardbreak immediately before it.
              if (
                /^\^[a-zA-Z0-9-]+$/.test(child.content) &&
                k > 0 &&
                (token.children[k - 1].type === 'softbreak' ||
                  token.children[k - 1].type === 'hardbreak')
              ) {
                token.children.splice(k - 1, 2);
                break;
              }
            }
          }
        }
      }
    }
  });

  return md;
};

export default markdownItBlockAnchorIds;

/*global markdownit:readonly*/

/**
 * markdown-it plugin that adds HTML `id` attributes to block elements
 * carrying a `^blockid` anchor marker (e.g. `Some text ^myblock`).
 *
 * This enables in-preview fragment navigation: clicking `[[note#^myblock]]`
 * in the preview can scroll directly to the target block.
 *
 * For each block element whose inline content ends with ` ^[a-zA-Z0-9-]+`:
 * - An `id="__blockid"` attribute is set on the opening HTML element
 *   (paragraph, list item, blockquote paragraph, etc.)
 * - For headings, a separate `<a id="__blockid" aria-hidden="true"></a>`
 *   anchor is inserted just before the heading tag instead, so that any
 *   auto-generated heading slug id (used by section links) is preserved.
 * - The `__` prefix minimises collisions with section-based ids.
 * - The ` ^blockid` marker is stripped from the visible rendered text.
 */

const BLOCK_ANCHOR_RE = /\s\^([a-zA-Z0-9-]+)$/;

export const markdownItBlockAnchorIds = (md: markdownit) => {
  md.core.ruler.push('block-anchor-ids', state => {
    const tokens = state.tokens;

    // Iterate in reverse so that splice insertions don't affect
    // the indices of tokens we have yet to visit.
    for (let i = tokens.length - 1; i >= 1; i--) {
      const token = tokens[i];
      if (token.type !== 'inline') {
        continue;
      }

      const match = token.content.match(BLOCK_ANCHOR_RE);
      if (!match) {
        continue;
      }

      const blockId = match[1];
      let openToken = tokens[i - 1];

      // Only act when the preceding token is a block-level opening tag
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
        // Prefix with '__' to minimise collisions with section ids.
        const anchorToken = new state.Token('html_block', '', 0);
        anchorToken.content = `<a id="__${blockId}" aria-hidden="true"></a>\n`;
        tokens.splice(i - 1, 0, anchorToken);
      } else {
        // Prefix with '__' — minimises collisions with section-based ids and
        // avoids '^' which is not a valid CSS identifier character.
        openToken.attrSet('id', `__${blockId}`);
      }

      // Strip the ^id marker from the rendered inline children.
      if (token.children) {
        for (let k = token.children.length - 1; k >= 0; k--) {
          const child = token.children[k];
          if (child.type === 'text') {
            const stripped = child.content.replace(BLOCK_ANCHOR_RE, '');
            if (stripped !== child.content) {
              child.content = stripped;
              token.content = token.content.replace(BLOCK_ANCHOR_RE, '');
              break;
            }
          }
        }
      }
    }
  });

  return md;
};

export default markdownItBlockAnchorIds;

import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token';

// Matches a block ID at the end of a block (e.g., "^my-block-id")
const blockIdRegex = /\s*(\^[-_a-zA-Z0-9]+)\s*$/;

/**
 * Markdown-it plugin for Foam block IDs (inline ^block-id syntax).
 *
 * - Removes block IDs from the rendered text for all block types.
 * - For paragraphs and list items, cleans the block ID from the text.
 */
export function markdownItblockIdRemoval(
  md: MarkdownIt,
  _workspace?: any,
  _parser?: any
) {
  md.core.ruler.push('foam_block_id_inline', state => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      // Look for: block_open, inline, block_close
      const openToken = tokens[i];
      const inlineToken = tokens[i + 1];
      const closeToken = tokens[i + 2];

      if (
        !inlineToken ||
        !closeToken ||
        inlineToken.type !== 'inline' ||
        openToken.nesting !== 1 ||
        closeToken.nesting !== -1
      ) {
        continue;
      }

      const match = inlineToken.content.match(blockIdRegex);
      if (!match) {
        continue;
      }

      // Remove the block ID from the text content for all block types
      inlineToken.content = inlineToken.content.replace(blockIdRegex, '');
      if (inlineToken.children) {
        // Also clean from the last text child, which is where it will be
        const lastChild = inlineToken.children[inlineToken.children.length - 1];
        if (lastChild && lastChild.type === 'text') {
          lastChild.content = lastChild.content.replace(blockIdRegex, '');
        }
      }
    }
    return true;
  });
  return md;
}

/*global markdownit:readonly*/

/**
 * Markdown-it plugin to handle wikilink aliases in tables by wrapping the table parser.
 *
 * This plugin addresses issue #1544 where wikilink aliases (e.g., [[note|alias]])
 * are incorrectly split into separate table cells because the pipe character `|`
 * is used both as a wikilink alias separator and a table column separator.
 *
 * The plugin works by wrapping the table block parser:
 * 1. Before the table parser runs, temporarily replace pipes in wikilinks with a placeholder
 * 2. Let the table parser create the table structure and inline tokens
 * 3. After the table parser returns, restore pipes in the inline token content
 * 4. Later inline parsing will see the correct wikilink syntax with pipes
 *
 * This approach keeps all encoding/decoding logic localized to this single function,
 * making it invisible to the rest of the codebase.
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
 * Regex to match wikilinks with pipes (aliases or multiple pipes)
 * Matches:
 * - [[note|alias]]
 * - ![[note|alias]] (embeds)
 * - [[note#section|alias]]
 */
const WIKILINK_WITH_PIPE_REGEX = /!?\[\[([^\]]*?\|[^\]]*?)\]\]/g;

/**
 * Replace pipes within wikilinks with placeholder
 */
function encodePipesInWikilinks(text: string): string {
  return text.replace(WIKILINK_WITH_PIPE_REGEX, match => {
    return match.replace(/\|/g, PIPE_PLACEHOLDER);
  });
}

/**
 * Restore pipes from placeholder in text
 */
function decodePipesInWikilinks(text: string): string {
  return text.replace(new RegExp(PIPE_PLACEHOLDER, 'g'), '|');
}

export const escapeWikilinkPipes = (md: markdownit) => {
  // Get the original table parser function
  // Note: __find__ and __rules__ are internal APIs but necessary for wrapping
  const ruler = md.block.ruler as any;
  const tableRuleIndex = ruler.__find__('table');
  if (tableRuleIndex === -1) {
    // Table rule not found (maybe GFM tables not enabled), skip wrapping
    return md;
  }

  const originalTableRule = ruler.__rules__[tableRuleIndex].fn;

  // Create wrapped table parser
  const wrappedTableRule = function (state, startLine, endLine, silent) {
    // Store the token count before parsing to identify new tokens
    const tokensBefore = state.tokens.length;

    // 1. ENCODE: Replace pipes in wikilinks with placeholder in source
    const originalSrc = state.src;
    state.src = encodePipesInWikilinks(state.src);

    // 2. Call the original table parser
    // It will create tokens with encoded content (pipes replaced)
    const result = originalTableRule(state, startLine, endLine, silent);

    // 3. DECODE: Restore pipes in the newly created inline tokens
    if (result) {
      // Only process tokens that were created by this table parse
      for (let i = tokensBefore; i < state.tokens.length; i++) {
        const token = state.tokens[i];
        // Inline tokens contain the cell content that needs decoding
        if (token.type === 'inline' && token.content) {
          token.content = decodePipesInWikilinks(token.content);
        }
      }
    }

    // 4. Restore original source
    state.src = originalSrc;

    return result;
  };

  // Replace the table rule with our wrapped version
  md.block.ruler.at('table', wrappedTableRule);

  return md;
};

export default escapeWikilinkPipes;

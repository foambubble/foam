import { MarkdownConfig } from '@lezer/markdown';

/**
 * A `@lezer/markdown` extension for Foam wikilinks: `[[target]]`,
 * `[[target|alias]]` and the embed form `![[target]]`.
 *
 * Without it, `[[a]]` parses as a `Link` nested inside another `Link` (both
 * bracket pairs look like shortcut reference links to CommonMark), and `![[a]]`
 * as an `Image` wrapping a `Link`.
 *
 * The parser is registered before `Link` so it claims the brackets first.
 */

const BANG = 33; // !
const OPEN = 91; // [
const CLOSE = 93; // ]
const NEWLINE = 10;

/** Node emitted for the whole construct, including brackets and any `!` */
export const WIKILINK_NODE = 'Wikilink';
/** Node emitted for the `[[` / `]]` / `![[` delimiters */
export const WIKILINK_MARK_NODE = 'WikilinkMark';

export const Wikilink: MarkdownConfig = {
  defineNodes: [{ name: WIKILINK_NODE }, { name: WIKILINK_MARK_NODE }],
  parseInline: [
    {
      name: WIKILINK_NODE,
      before: 'Link',
      parse(cx, next, pos) {
        const isEmbed =
          next === BANG && cx.char(pos + 1) === OPEN && cx.char(pos + 2) === OPEN;
        const isLink = next === OPEN && cx.char(pos + 1) === OPEN;
        if (!isEmbed && !isLink) {
          return -1;
        }

        const contentStart = pos + (isEmbed ? 3 : 2);
        const limit = cx.offset + cx.text.length;
        let closeStart = -1;
        for (let i = contentStart; i < limit - 1; i++) {
          const char = cx.char(i);
          // wikilinks do not span lines, and an inner `[` means this is
          // something else (e.g. a nested reference link)
          if (char === NEWLINE || char === OPEN) {
            break;
          }
          if (char === CLOSE && cx.char(i + 1) === CLOSE) {
            closeStart = i;
            break;
          }
        }
        if (closeStart < 0) {
          return -1;
        }

        return cx.addElement(
          cx.elt(WIKILINK_NODE, pos, closeStart + 2, [
            cx.elt(WIKILINK_MARK_NODE, pos, contentStart),
            cx.elt(WIKILINK_MARK_NODE, closeStart, closeStart + 2),
          ])
        );
      },
    },
  ],
};

/**
 * Where the list items of a markdown text start, read line by line by the
 * block rules of core's parser: remark-parse 8 with GFM, not in CommonMark
 * mode, and YAML frontmatter. Only what decides where a list item can be is
 * followed: frontmatter, code, HTML blocks, tables, block quotes, lists and
 * paragraphs. Inline markdown is not read.
 */

import { closesFence, fenceOpening } from './code-fence';
import { frontmatterClose } from './frontmatter';

/**
 * The opening of a list item on its first line: indentation, bullet (`-`,
 * `*`, `+`, or a number and `.`), the space after the bullet, and the GFM
 * checkbox (`[ ]`, `[x]` or `[X]`, followed by a space or a tab) when it has
 * one. A space or tab between the brackets also reads as open.
 */
export const LIST_ITEM_OPENING =
  /^([ \t]*)([*+-]|\d+\.)( {1,4}(?! )| |\t|$)(\[[ \txX]\](?=[ \t]))?/;

/** A line, or the part of it left inside block quotes and list items. */
export interface Row {
  /** Its line in the text, from 0. */
  line: number;
  /** Where the part starts in the line. */
  col: number;
}

/** A list item: where its content starts, after the bullet. */
export interface ListItem extends Row {
  /** Where its bullet, `-`, `*`, `+` or a number and `.`, starts in the line. */
  bullet: number;
  /** Whether its GFM checkbox is ticked; null without one. */
  checked: boolean | null;
}

const TAB_SIZE = 4;

const BLANK = /^[ \t]*$/;
const QUOTE = /^[ \t]*>/;
const QUOTE_MARKER = /^[ \t]*> ?/;
const ATX_HEADING = /^[ \t]*#{1,6}(?:[ \t]|$)/;
const THEMATIC_BREAK = /^[ \t]*([-*_])(?: *\1){2,} *$/;
const SETEXT_UNDERLINE = /^(?:=+|-+)$/;
const LIST_START = /^[ \t]*(?:[*+-]|\d+\.)(?:[ \t]|$)/;
const LIST_INTERRUPT = /^[ \t]*(?:[*+-]|1\.)(?:[ \t]|$)/;
const DEFINITION_START = /^[ \t]*\[/;

const HTML_BLOCK_NAMES =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hgroup|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|pre|section|source|title|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const ATTRIBUTE =
  '(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"\'=<>`\\u0000-\\u0020]+|\'[^\']*\'|"[^"]*"))?)';
const OPEN_CLOSE_TAG = `(?:<[A-Za-z][A-Za-z0-9\\-]*${ATTRIBUTE}*\\s*\\/?>|<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>)`;

/** An HTML block's first line, its last line, and whether it can end a paragraph. */
const HTML_BLOCKS: [RegExp, RegExp, boolean][] = [
  [/^<(script|pre|style)(?=(\s|>|$))/i, /<\/(script|pre|style)>/i, true],
  [/^<!--/, /-->/, true],
  [/^<\?/, /\?>/, true],
  [/^<![A-Za-z]/, />/, true],
  [/^<!\[CDATA\[/, /]]>/, true],
  [new RegExp(`^</?(${HTML_BLOCK_NAMES})(?=(\\s|/?>|$))`, 'i'), /^$/, true],
  [new RegExp(`^${OPEN_CLOSE_TAG}\\s*$`), /^$/, false],
];

const isBlank = (text: string) => BLANK.test(text);

/** `text` has nothing but whitespace, as remark's `trim` sees it. */
const isEmpty = (text: string) => text.trim() === '';

/** Indented code starts with four spaces or a tab. */
const isIndented = (text: string) =>
  text.startsWith('    ') || text.startsWith('\t');

/** How far `text` is indented, and the index of the character reaching each column. */
function indentation(text: string): { indent: number; stops: number[] } {
  const stops: number[] = [];
  let indent = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== ' ' && char !== '\t') {
      break;
    }
    indent =
      char === '\t'
        ? Math.floor((indent + TAB_SIZE) / TAB_SIZE) * TAB_SIZE
        : indent + 1;
    while (stops.length < indent) {
      stops.push(i);
    }
  }
  return { indent, stops };
}

/** Where the HTML block opened on `text` ends, and whether it can end a paragraph. */
function htmlBlock(text: string): [RegExp, boolean] | null {
  const start = /^[ \t]*</.exec(text);
  if (!start) {
    return null;
  }
  const line = text.slice(start[0].length - 1);
  const block = HTML_BLOCKS.find(([open]) => open.test(line));
  return block ? [block[1], block[2]] : null;
}

/** Whether the alignment row of a table is `text`. */
function isAlignmentRow(text: string): boolean {
  let columns = 0;
  let cell: boolean | null = null;
  let first = true;
  for (const char of text) {
    if (char === '|') {
      if (cell === null && !first) {
        return false;
      }
      if (cell !== null) {
        columns++;
      }
      cell = null;
      first = false;
    } else if (char === '-' || char === ':') {
      cell = true;
    } else if (!/\s/.test(char)) {
      return false;
    }
  }
  return columns + (cell === null ? 0 : 1) > 0;
}

/** Whether `text` is a table row: it has a `|` after its first character. */
const isTableRow = (text: string) => text.indexOf('|', 1) !== -1;

/**
 * How many of `texts`, from `i`, a link definition takes; 0 when there is
 * none at `i`.
 */
function definitionAt(texts: string[], i: number): number {
  if (!DEFINITION_START.test(texts[i])) {
    return 0;
  }
  // The label may run over lines; most texts starting with `[` aren't one.
  const label = /^[ \t]*\[((?:\\[\s\S]|[^\\\]])*)\](:?)/.exec(texts[i]);
  if (label && (label[1] === '' || label[2] === '')) {
    return 0;
  }
  const value = texts.slice(i).join('\n');
  // A destination opened with `<` and closed with `>` is that much (`<>`
  // takes what follows it); one never closed is read as a plain one.
  const match =
    /^[ \t]*\[(?:\\[\s\S]|[^\\\]])+\]:[ \t\n]*(?:<[^>[\]]+>|<>[^[\]\s]+|(?!<[^>[\]]*>)[^[\]\s]+)(?:[ \t\n]+(?:"(?:[^"\n]|\n(?![\n"]))*"|'(?:[^'\n]|\n(?![\n']))*'|\((?:[^)\n]|\n(?![\n)]))*\)))?[ \t]*(?:\n|$)/.exec(
      value
    );
  return match ? match[0].replace(/\n$/, '').split('\n').length : 0;
}

/** Whether a setext heading starts at `i`: a line, then one of `=` or `-` only. */
const isSetextHeading = (texts: string[], i: number) =>
  i + 1 < texts.length && SETEXT_UNDERLINE.test(texts[i + 1]);

/** Whether the line at `i` ends a paragraph above it. */
function interruptsParagraph(texts: string[], i: number): boolean {
  const text = texts[i];
  return (
    THEMATIC_BREAK.test(text) ||
    LIST_INTERRUPT.test(text) ||
    ATX_HEADING.test(text) ||
    fenceOpening(text) !== null ||
    QUOTE.test(text) ||
    htmlBlock(text)?.[1] === true ||
    isSetextHeading(texts, i) ||
    definitionAt(texts, i) > 0
  );
}

/**
 * Whether `text`, a line not indented into a list, ends it. Unlike for a
 * paragraph, only that line is looked at.
 */
const interruptsList = (text: string) =>
  ATX_HEADING.test(text) ||
  fenceOpening(text) !== null ||
  THEMATIC_BREAK.test(text) ||
  definitionAt([text], 0) > 0;

class BlockReader {
  /** The list items read, in the order they open. */
  readonly items: ListItem[] = [];
  /** No block read yet: YAML frontmatter can still open. */
  private atStart = true;

  constructor(private readonly lines: string[]) {}

  /** Reads the blocks of `rows`. */
  blocks(rows: Row[]): void {
    const texts = rows.map(row => this.lines[row.line].slice(row.col));
    let i = 0;
    while (i < rows.length) {
      if (isBlank(texts[i])) {
        i++;
        continue;
      }
      if (this.atStart) {
        const close = frontmatterClose(texts, i);
        if (close !== -1) {
          this.atStart = false;
          // What follows the closing dashes on their line is read on.
          rows[close] = { line: rows[close].line, col: rows[close].col + 3 };
          texts[close] = texts[close].slice(3);
          i = close;
          continue;
        }
      }
      i += this.block(rows, texts, i);
      this.atStart = false;
    }
  }

  /** Reads the block that starts at `i`; returns how many rows it takes. */
  private block(rows: Row[], texts: string[], i: number): number {
    const text = texts[i];
    if (isIndented(text)) {
      // Blank lines inside the code belong to it; those after it don't.
      let end = i + 1;
      for (let j = i + 1; j < texts.length; j++) {
        if (isIndented(texts[j])) {
          end = j + 1;
        } else if (!isBlank(texts[j])) {
          break;
        }
      }
      return end - i;
    }
    const fence = fenceOpening(text);
    if (fence) {
      for (let j = i + 1; j < texts.length; j++) {
        if (closesFence(texts[j], fence)) {
          return j - i + 1;
        }
      }
      return texts.length - i;
    }
    if (QUOTE.test(text)) {
      return this.quote(rows, texts, i);
    }
    if (ATX_HEADING.test(text) || THEMATIC_BREAK.test(text)) {
      return 1;
    }
    if (LIST_START.test(text)) {
      return this.list(rows, texts, i);
    }
    if (isSetextHeading(texts, i)) {
      return 2;
    }
    const html = htmlBlock(text);
    if (html) {
      const [close] = html;
      if (close.test(text.replace(/^[ \t]*/, ''))) {
        return 1;
      }
      for (let j = i + 1; j < texts.length; j++) {
        if (close.test(texts[j])) {
          return texts[j] === '' ? j - i : j - i + 1;
        }
      }
      return texts.length - i;
    }
    const definition = definitionAt(texts, i);
    if (definition > 0) {
      return definition;
    }
    if (
      isTableRow(text) &&
      i + 1 < texts.length &&
      isTableRow(texts[i + 1]) &&
      isAlignmentRow(texts[i + 1])
    ) {
      let end = i + 2;
      while (end < texts.length && isTableRow(texts[end])) {
        end++;
      }
      return end - i;
    }
    let end = i + 1;
    while (
      end < texts.length &&
      texts[end] !== '' &&
      !interruptsParagraph(texts, end) &&
      !isEmpty(texts[end])
    ) {
      end++;
    }
    return end - i;
  }

  private quote(rows: Row[], texts: string[], i: number): number {
    const inner: Row[] = [];
    let j = i;
    for (; j < rows.length; j++) {
      const marker = QUOTE_MARKER.exec(texts[j]);
      if (marker) {
        inner.push({ line: rows[j].line, col: rows[j].col + marker[0].length });
        continue;
      }
      if (isEmpty(texts[j]) || definitionAt(texts, j) > 0) {
        break;
      }
      inner.push(rows[j]);
    }
    this.blocks(inner);
    return j - i;
  }

  private list(rows: Row[], texts: string[], i: number): number {
    // The list is added before its items are read.
    this.atStart = false;
    const items: { rows: number[]; indent: number }[] = [];
    let item: { rows: number[]; indent: number } | null = null;
    let marker: string | null = null;
    let waiting: number[] = [];
    let empty = false;
    let end = i;
    for (let j = i; j < texts.length; j++) {
      const text = texts[j];
      let at = 0;
      let size = 0;
      for (; at < text.length; at++) {
        if (text[at] === '\t') {
          size += TAB_SIZE - (size % TAB_SIZE);
        } else if (text[at] === ' ') {
          size++;
        } else {
          break;
        }
      }
      let indented = item !== null && size >= item.indent;
      let current: string | null = null;
      if (!indented) {
        const ordered = /^\d+\./.exec(text.slice(at));
        if ('*+-'.includes(text[at] ?? '|')) {
          current = text[at];
          at++;
          size++;
        } else if (ordered) {
          current = '.';
          at += ordered[0].length;
          size += ordered[0].length;
        }
        if (current !== null) {
          if (text[at] === '\t') {
            size += TAB_SIZE - (size % TAB_SIZE);
            at++;
          } else if (text[at] === ' ') {
            const stop = at + TAB_SIZE;
            while (at < stop && text[at] === ' ') {
              at++;
              size++;
            }
            if (at === stop && text[at] === ' ') {
              at -= TAB_SIZE - 1;
              size -= TAB_SIZE - 1;
            }
          } else if (at < text.length) {
            current = null;
          }
        }
      }
      marker ??= current;
      if (current !== null && current !== marker) {
        break;
      }
      if (current === null && !indented && text[0] === ' ') {
        indented = true;
      }
      if ((current === '*' || current === '-') && THEMATIC_BREAK.test(text)) {
        break;
      }
      const previousEmpty = empty;
      empty = current === null && isEmpty(text);
      if (indented && item) {
        item.rows.push(...waiting, j);
        waiting = [];
        end = j;
      } else if (current !== null) {
        item = { rows: [j], indent: size };
        items.push(item);
        waiting = [];
        end = j;
      } else if (empty) {
        if (previousEmpty) {
          break;
        }
        waiting.push(j);
      } else {
        if (previousEmpty || interruptsList(text)) {
          break;
        }
        item!.rows.push(...waiting, j);
        waiting = [];
        end = j;
      }
    }
    for (const { rows: lines } of items) {
      this.item(
        lines.map(j => rows[j]),
        lines.map(j => texts[j])
      );
    }
    return end - i + 1;
  }

  /** Reads a list item whose rows, from its bullet on, are `rows`. */
  private item(rows: Row[], texts: string[]): void {
    const [, indent, number, space, checkbox] = LIST_ITEM_OPENING.exec(
      texts[0]
    )!;
    const bullet = indent + number + space;
    // remark lets the first nine numbered items indent one column more.
    const width =
      Number(number) < 10 && bullet.length % 2 === 1
        ? number.length + 1
        : number.length;
    // The bullet counts as that many spaces of indentation.
    const asSpaces = indent + ' '.repeat(width) + space;
    let least = indentation(asSpaces).indent;
    for (const text of [
      asSpaces + texts[0].slice(bullet.length),
      ...texts.slice(1),
    ]) {
      if (isEmpty(text)) {
        continue;
      }
      const { indent: columns } = indentation(text);
      if (columns === 0) {
        least = Infinity;
        break;
      }
      least = Math.min(least, columns);
    }
    const content = rows.map((row, k) => {
      if (k === 0) {
        return { line: row.line, col: row.col + bullet.length };
      }
      if (least === Infinity) {
        return row;
      }
      const { stops } = indentation(texts[k]);
      const reached = Math.min(least, stops.length);
      return {
        line: row.line,
        col: row.col + (reached > 0 ? stops[reached - 1] + 1 : 0),
      };
    });
    this.items.push({
      ...content[0],
      bullet: rows[0].col + indent.length,
      checked: checkbox ? checkbox[1] === 'x' || checkbox[1] === 'X' : null,
    });
    if (checkbox) {
      content[0] = { line: content[0].line, col: content[0].col + 4 };
    }
    this.blocks(content);
  }
}

/**
 * The list items of a text, given as its lines without their line endings,
 * in the order they open.
 */
export function listItemsOf(lines: string[]): ListItem[] {
  const reader = new BlockReader(lines);
  reader.blocks(lines.map((_, line) => ({ line, col: 0 })));
  return reader.items;
}

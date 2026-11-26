import unified from 'unified';

const WORD_CHAR = /\w/;
// From four spaces of indentation on, the line is indented code
const BLOCK_FENCE = /^ {0,3}\$\$/;

/**
 * Reads `$…$` and `$$…$$` as math: `inlineMath` nodes, whose delimiter is in
 * `data.delimiter`, and `math` nodes for display blocks. Nothing inside them
 * is read as a wikilink, a link or a tag.
 *
 * What counts as math follows VS Code's Markdown preview
 * (`@vscode/markdown-it-katex`), except that a `$$` block counts only once
 * it is closed.
 */
export function mathSyntax(this: unified.Processor) {
  const proto = (this.Parser as any).prototype;
  proto.inlineTokenizers.math = inlineMath;
  proto.inlineMethods.splice(proto.inlineMethods.indexOf('text'), 0, 'math');
  proto.blockTokenizers.math = blockMath;
  proto.blockMethods.splice(
    proto.blockMethods.indexOf('fencedCode') + 1,
    0,
    'math'
  );
  proto.interruptParagraph.push(['math']);
}

function inlineMath(eat: any, value: string, silent?: boolean) {
  if (value.charAt(0) !== '$') {
    return;
  }
  const delimiter = value.startsWith('$$') ? '$$' : '$';
  // `value` starts at the current position, so the character before it is
  // only in the source
  const before = String(eat.file).charAt(eat.now().offset - 1);
  if (before === '$' || before === '\\') {
    return;
  }
  if (delimiter === '$' ? WORD_CHAR.test(before) : value.charAt(2) === '$') {
    return;
  }

  const close = findClosingDelimiter(value, delimiter);
  if (close === -1) {
    return;
  }
  const after = value.charAt(close + delimiter.length);
  const canClose =
    delimiter === '$'
      ? after !== '$' && !WORD_CHAR.test(after)
      : after !== '$' && !['$', '\\'].includes(value.charAt(close - 1));
  if (!canClose) {
    return;
  }

  if (silent) {
    return true;
  }
  return eat(value.slice(0, close + delimiter.length))({
    type: 'inlineMath',
    value: value.slice(delimiter.length, close),
    data: { delimiter },
  });
}
inlineMath.locator = (value: string, fromIndex: number) =>
  value.indexOf('$', fromIndex);

/**
 * The first unescaped `delimiter` after the opening one: the only one that
 * can close it
 */
function findClosingDelimiter(value: string, delimiter: string): number {
  let index = value.indexOf(delimiter, delimiter.length);
  while (index !== -1) {
    let backslashes = 0;
    while (value.charAt(index - 1 - backslashes) === '\\') {
      backslashes++;
    }
    if (backslashes % 2 === 0) {
      return index;
    }
    index = value.indexOf(delimiter, index + delimiter.length);
  }
  return -1;
}

/**
 * From a line starting with `$$` to the end of the next line holding `$$`,
 * whatever the lines in between look like; or `$$…$$` alone on its line
 */
function blockMath(eat: any, value: string, silent?: boolean) {
  const fence = BLOCK_FENCE.exec(value);
  if (!fence) {
    return;
  }
  const firstLineEnd = lineEnd(value, 0);
  const firstLine = value.slice(fence[0].length, firstLineEnd).trimEnd();

  let end: number;
  let formula: string;
  if (firstLine.includes('$$')) {
    // A single `$$`, ending the line
    const single = firstLine.indexOf('$$') === firstLine.lastIndexOf('$$');
    if (!single || !firstLine.endsWith('$$')) {
      return;
    }
    end = firstLineEnd;
    formula = firstLine.slice(0, -2);
  } else {
    const close = value.indexOf('$$', firstLineEnd);
    if (close === -1) {
      return;
    }
    end = lineEnd(value, close);
    formula = value.slice(fence[0].length, close);
  }

  if (silent) {
    return true;
  }
  return eat(value.slice(0, end))({ type: 'math', value: formula.trim() });
}

const lineEnd = (value: string, from: number): number => {
  const index = value.indexOf('\n', from);
  return index === -1 ? value.length : index;
};

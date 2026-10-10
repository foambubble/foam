/** An open fenced code block: the character of its fence and how many. */
export interface CodeFence {
  char: string;
  length: number;
}

const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})/;

/**
 * The fenced code block `line` opens, if it opens one: three or more
 * backticks or tildes, after any indentation; backticks with none after them.
 */
export function fenceOpening(line: string): CodeFence | null {
  const open = FENCE_OPEN.exec(line);
  if (!open) {
    return null;
  }
  const run = open[1];
  return run[0] === '`' && line.includes('`', open[0].length)
    ? null
    : { char: run[0], length: run.length };
}

/**
 * Whether `line` closes the code block `fence` opened: up to three spaces,
 * then a run of the same character at least as long, then nothing.
 */
export function closesFence(line: string, fence: CodeFence): boolean {
  let i = 0;
  while (line[i] === ' ') {
    i++;
  }
  if (i > 3) {
    return false;
  }
  const start = i;
  while (line[i] === fence.char) {
    i++;
  }
  return i - start >= fence.length && /^[ \t]*$/.test(line.slice(i));
}

/**
 * The fenced code block open after `line`, given the one open before it
 * (null outside any).
 */
export function fenceAfter(
  open: CodeFence | null,
  line: string
): CodeFence | null {
  if (open) {
    return closesFence(line, open) ? null : open;
  }
  return fenceOpening(line);
}

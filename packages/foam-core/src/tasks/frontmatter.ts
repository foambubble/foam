/**
 * The line that closes YAML frontmatter opening at `open` of `lines`, as
 * core's parser bounds it: frontmatter opens with a line of `---` alone,
 * before anything but blank lines, and closes at the next line starting with
 * `---`. -1 when `open` doesn't open frontmatter.
 */
export function frontmatterClose(lines: string[], open: number): number {
  if (lines[open] !== '---') {
    return -1;
  }
  for (let line = open + 1; line < lines.length; line++) {
    if (lines[line].startsWith('---')) {
      return line;
    }
  }
  return -1;
}

/**
 * Where `content`'s text starts after its frontmatter, right after the
 * closing dashes; 0 without frontmatter.
 */
export function bodyStart(content: string): number {
  const bom = content.startsWith('﻿') ? 1 : 0;
  const lines = content
    .slice(bom)
    .split('\n')
    .map(line => line.replace(/\r$/, ''));
  const open = lines.findIndex(line => !/^[ \t]*$/.test(line));
  const close = open === -1 ? -1 : frontmatterClose(lines, open);
  if (close === -1) {
    return 0;
  }
  let offset = bom;
  for (let line = 0; line < close; line++) {
    offset = content.indexOf('\n', offset) + 1;
  }
  return offset + 3;
}

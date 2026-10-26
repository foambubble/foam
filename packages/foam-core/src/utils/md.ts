import { Section } from '../model/note';
import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import { isSome } from './core';

export function getExcerpt(
  markdown: string,
  maxLines: number
): { excerpt: string; lines: number } {
  const OFFSET_LINES_LIMIT = 5;
  const paragraphs = markdown.replace(/\r\n/g, '\n').split('\n\n');
  const excerpt: string[] = [];
  let lines = 0;
  for (const paragraph of paragraphs) {
    const n = paragraph.split('\n').length;
    if (lines > maxLines || lines + n - maxLines > OFFSET_LINES_LIMIT) {
      break;
    }
    excerpt.push(paragraph);
    lines = lines + n + 1;
  }
  return { excerpt: excerpt.join('\n\n'), lines };
}

/**
 * Where the YAML frontmatter of `markdown` is, as core's parser reads it:
 * after nothing but blank lines, a line of `---` alone opens it, and the next
 * line starting with `---` closes it, right after those dashes. Null when
 * `markdown` has none.
 *
 * Not gray-matter: it needs Node's Buffer at call time, which non-Node
 * runtimes (React Native / Hermes) lack.
 */
export function getFrontMatterRange(markdown: string): Range | null {
  const lines = markdown.split('\n').map(line => line.replace(/\r$/, ''));
  const frontMatter = frontMatterLines(lines);
  if (frontMatter === null || frontMatter.close === -1) {
    return null;
  }
  const { open, close } = frontMatter;
  // A byte order mark sits before the first line's text
  const bom = open === 0 && lines[0].charCodeAt(0) === 0xfeff ? 1 : 0;
  return Range.create(open, bom, close, 3);
}

/**
 * The lines that open and close the frontmatter of `lines`, given without
 * their `\r`, by the rule of {@link getFrontMatterRange}; `close` is -1 when
 * no line closes it. Null when no line opens one.
 */
function frontMatterLines(
  lines: string[]
): { open: number; close: number } | null {
  const textOf = (line: number) =>
    line === 0 && lines[0].charCodeAt(0) === 0xfeff
      ? lines[0].slice(1)
      : lines[line];
  let open = 0;
  while (open < lines.length && !/[^ \t]/.test(textOf(open))) {
    open++;
  }
  if (open === lines.length || textOf(open) !== '---') {
    return null;
  }
  let close = open + 1;
  while (close < lines.length && !lines[close].startsWith('---')) {
    close++;
  }
  return { open, close: close === lines.length ? -1 : close };
}

export function stripFrontMatter(markdown: string): string {
  return withoutFrontMatter(markdown, getFrontMatterRange(markdown));
}

/**
 * Strips the frontmatter and the title heading: the first H1, the heading the
 * parser takes the title from. `sections` must come from parsing `markdown`.
 * The title's lines are blanked rather than removed, keeping every line where
 * the frontmatter was found.
 */
export function stripFrontMatterAndTitle(
  markdown: string,
  sections: Section[]
): string {
  const title = sections.find(s => s.level === 1);
  if (!title) {
    return stripFrontMatter(markdown);
  }
  const { start, end } = title.headingRange;
  const lines = markdown.split('\n');
  lines.fill('', start.line, end.line + 1);
  return withoutFrontMatter(lines.join('\n'), getFrontMatterRange(markdown));
}

/** `markdown` after `frontMatter`, without leading blank lines or trailing whitespace. */
function withoutFrontMatter(
  markdown: string,
  frontMatter: Range | null
): string {
  const body =
    frontMatter === null
      ? markdown
      : TextEdit.apply(markdown, {
          range: Range.create(
            0,
            0,
            frontMatter.end.line,
            frontMatter.end.character
          ),
          newText: '',
        });
  // Drop leading blank lines but not the first line's indentation, which
  // would turn an indented code block into a paragraph.
  return body.replace(/^\s*\n/, '').trimEnd();
}

export function stripImages(markdown: string): string {
  return markdown.replace(
    /!\[(.*)\]\([-/\\.A-Za-z]*\)/gi,
    '$1'.length ? '[Image: $1]' : ''
  );
}

/**
 * Whether line `lineNumber` (from 0) of `content` is inside its frontmatter,
 * between the lines that open and close it by the rule of
 * {@link getFrontMatterRange}. A block opened and not closed counts to the
 * end of `content`, which may stop where a note is being written.
 */
export function isInFrontMatter(content: string, lineNumber: number): boolean {
  const frontMatter = frontMatterLines(
    content.split('\n').map(line => line.replace(/\r$/, ''))
  );
  return (
    frontMatter !== null &&
    lineNumber > frontMatter.open &&
    (frontMatter.close === -1 || lineNumber < frontMatter.close)
  );
}

/**
 * The top-level key a line of frontmatter YAML starts, unquoted: at column 0,
 * not a list item or a comment, up to its colon. Undefined for a line that
 * continues the value of the key above it.
 */
export function getYAMLKey(line: string): string | undefined {
  return /^([^-\s#][^:]*?):/.exec(line)?.[1].replace(/^(["'])(.*)\1$/, '$2');
}

/** Whether the last key `content` starts, by {@link getYAMLKey}, is `keyword`. */
export function isOnYAMLKeywordLine(content: string, keyword: string): boolean {
  const keys = content.split('\n').map(getYAMLKey).filter(isSome);
  return keys[keys.length - 1] === keyword;
}

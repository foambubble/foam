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

// A frontmatter block: `---` on the first line, then anything up to the
// first closing `---` or `...` line. Implemented without gray-matter:
// gray-matter requires Node's Buffer at call time, which crashes non-Node
// runtimes (React Native / Hermes), and this function is on the mobile
// render path. Unlike gray-matter, an unclosed opening delimiter is NOT
// treated as frontmatter (gray-matter would swallow the whole document).
const FRONTMATTER_BLOCK_REGEX = /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export function stripFrontMatter(markdown: string): string {
  return markdown.replace(FRONTMATTER_BLOCK_REGEX, '').trim();
}

export function stripImages(markdown: string): string {
  return markdown.replace(
    /!\[(.*)\]\([-/\\.A-Za-z]*\)/gi,
    '$1'.length ? '[Image: $1]' : ''
  );
}

/**
 * Returns if the given line is inside a front matter block
 * @param content the string to check
 * @param lineNumber the line number within the string, 0-based
 * @returns true if the line is inside a frontmatter block in content
 */
export function isInFrontMatter(content: string, lineNumber: number): boolean {
  const FIRST_DELIMITER_MATCH = /^---\s*?$/m;
  const LAST_DELIMITER_MATCH = /^(-{3}|\.{3})/;

  // if we're on the first line, we're not _yet_ in the front matter
  if (lineNumber === 0) {
    return false;
  }

  // look for --- at start, and a second --- or ... to end
  if (content.match(FIRST_DELIMITER_MATCH) === null) {
    return false;
  }

  const lines = content.split('\n');
  lines.shift();
  const endLineNumber = lines.findIndex(l => l.match(LAST_DELIMITER_MATCH));

  return endLineNumber === -1 || endLineNumber >= lineNumber;
}

export function isOnYAMLKeywordLine(content: string, keyword: string): boolean {
  const keywordMatch = /^\s*(\w+):/gm;

  if (content.match(keywordMatch) === null) {
    return false;
  }

  const matches = Array.from(content.matchAll(keywordMatch));
  const lastMatch = matches[matches.length - 1];
  return lastMatch[1] === keyword;
}

import matter from 'gray-matter';
import { Position } from '../model/position'; // Add Position import to the top

/**
 * Gets the raw text of a node from the source markdown.
 * @param node The AST node with position info.
 * @param markdown The full markdown source string.
 * @returns The raw text corresponding to the node.
 */

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

export function stripFrontMatter(markdown: string): string {
  return matter(markdown).content.trim();
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

/**
 * Extracts a contiguous block of non-empty lines from a Markdown string.
 *
 * @param markdown The full Markdown string to extract from.
 * @param position The starting position (line number) for the extraction.
 * @returns An object containing:
 *          - `block`: The extracted string content of the block.
 *          - `nLines`: The total number of lines in the extracted block. This
 *            is calculated as `blockEnd - blockStart + 1`, which is crucial
 *            for consumers to know the exact range of the block.
 */
export function getBlockFor(
  markdown: string,
  position: Position
): { block: string; nLines: number } {
  const lines = markdown.split('\n');
  const blockStart = position.line;
  let blockEnd = blockStart;
  while (blockEnd < lines.length - 1 && lines[blockEnd + 1].trim() !== '') {
    blockEnd++;
  }
  const block = lines.slice(blockStart, blockEnd + 1).join('\n');
  const nLines = blockEnd - blockStart + 1;
  return { block, nLines };
}

/**
 * Adapted from vscode-markdown/src/util.ts
 * https://github.com/yzhang-gh/vscode-markdown/blob/master/src/util.ts
 */

export const REGEX_FENCED_CODE_BLOCK = /^( {0,3}|\t)```[^`\r\n]*$[\w\W]+?^( {0,3}|\t)``` *$/gm;

export function markdownHeadingToPlainText(text: string) {
  // Remove Markdown syntax (bold, italic, links etc.) in a heading
  // For example: `_italic_` -> `italic`
  return text.replace(/\[([^\]]*)\]\[[^\]]*\]/, (_, g1) => g1);
}

export function rxWikiLink(): RegExp {
  const pattern = '\\[\\[([^\\]]+)\\]\\]'; // [[wiki-link-regex]]
  return new RegExp(pattern, 'ig');
}

export function rxMarkdownHeading(level: number): RegExp {
  const pattern = `^#{${level}}\\s+(.+)$`;
  return new RegExp(pattern, 'im');
}

export const mdDocSelector = [
  { language: 'markdown', scheme: 'file' },
  { language: 'markdown', scheme: 'untitled' },
];

export function findTopLevelHeading(md: string): string | null {
  const regex = rxMarkdownHeading(1);
  const match = regex.exec(md);
  if (match) {
    return markdownHeadingToPlainText(match[1]);
  }

  return null;
}

export function cleanupMarkdown(markdown: string) {
  const replacer = (foundStr: string) => foundStr.replace(/[^\r\n]/g, '');
  return markdown
    .replace(REGEX_FENCED_CODE_BLOCK, replacer) //// Remove fenced code blocks (and #603, #675)
    .replace(/<!-- omit in (toc|TOC) -->/g, '&lt; omit in toc &gt;') //// Escape magic comment
    .replace(/<!--[\W\w]+?-->/g, replacer) //// Remove comments
    .replace(/^---[\W\w]+?(\r?\n)---/, replacer); //// Remove YAML front matter
}

export function findWikilinksInMarkdown(markdown: string): string[] {
  const md = cleanupMarkdown(markdown);
  const regex = rxWikiLink();
  const unique = new Set<string>();

  let match;
  while ((match = regex.exec(md))) {
    // can be file-name or file.name.ext
    const [, name] = match;
    if (name) {
      unique.add(name);
    }
  }

  return Array.from(unique);
}

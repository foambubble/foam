import {
  EndOfLine,
  Range,
  TextDocument,
  window,
  Position,
  TextEditor,
  workspace,
  Selection,
  MarkdownString,
  version,
  ViewColumn,
} from 'vscode';
import matter from 'gray-matter';
import removeMarkdown from 'remove-markdown';
import { toVsCodeUri } from './utils/vsc-utils';
import { Logger } from './core/utils/log';
import { URI } from './core/model/uri';

export const docConfig = { tab: '  ', eol: '\r\n' };

export const mdDocSelector = [
  { language: 'markdown', scheme: 'file' },
  { language: 'markdown', scheme: 'untitled' },
];

export function loadDocConfig() {
  // Load workspace config
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) {
    Logger.debug('Failed to load config, no active editor');
    return;
  }

  docConfig.eol = activeEditor.document.eol === EndOfLine.CRLF ? '\r\n' : '\n';

  const tabSize = Number(activeEditor.options.tabSize);
  const insertSpaces = activeEditor.options.insertSpaces;
  if (insertSpaces) {
    docConfig.tab = ' '.repeat(tabSize);
  } else {
    docConfig.tab = '\t';
  }
}

export function isMdEditor(editor: TextEditor) {
  return editor && editor.document && editor.document.languageId === 'markdown';
}

export function detectGeneratedCode(
  fullText: string,
  header: string,
  footer: string
): { range: Range | null; lines: string[] } {
  const lines = fullText.split(docConfig.eol);

  const headerLine = lines.findIndex(line => line === header);
  const footerLine = lines.findIndex(line => line === footer);

  if (headerLine < 0 || headerLine >= footerLine) {
    return {
      range: null,
      lines: [],
    };
  }

  return {
    range: new Range(
      new Position(headerLine, 0),
      new Position(footerLine, lines[footerLine].length + 1)
    ),
    lines: lines.slice(headerLine + 1, footerLine + 1),
  };
}

export function hasEmptyTrailing(doc: TextDocument): boolean {
  return doc.lineAt(doc.lineCount - 1).isEmptyOrWhitespace;
}

export function getText(range: Range): string {
  return window.activeTextEditor.document.getText(range);
}

/**
 * Used for the "Copy to Clipboard Without Brackets" command
 *
 */
export function removeBrackets(s: string): string {
  // take in the string, split on space
  const stringSplitBySpace = s.split(' ');

  // loop through words
  const modifiedWords = stringSplitBySpace.map(currentWord => {
    if (currentWord.includes('[[')) {
      // all of these transformations will turn this "[[you-are-awesome]]"
      // to this "you are awesome"
      let word = currentWord.replace(/(\[\[)/g, '');
      word = word.replace(/(\]\])/g, '');
      word = word.replace(/(.mdx|.md|.markdown)/g, '');
      word = word.replace(/[-]/g, ' ');

      // then we titlecase the word so "you are awesome"
      // becomes "You Are Awesome"
      const titleCasedWord = toTitleCase(word);

      return titleCasedWord;
    }

    return currentWord;
  });

  return modifiedWords.join(' ');
}

/**
 * Takes in a string and returns it titlecased
 *
 * @example toTitleCase("hello world") -> "Hello World"
 */
export function toTitleCase(word: string): string {
  return word
    .split(' ')
    .map(word => word[0].toUpperCase() + word.substring(1))
    .join(' ');
}

/**
 * Verify the given object is defined
 *
 * @param value The object to verify
 */
export function isSome<T>(
  value: T | null | undefined | void
): value is NonNullable<T> {
  //
  return value != null;
}

/**
 * Verify the given object is not defined
 *
 * @param value The object to verify
 */
export function isNone<T>(
  value: T | null | undefined | void
): value is null | undefined | void {
  return value == null;
}

export async function focusNote(
  notePath: URI,
  moveCursorToEnd: boolean,
  viewColumn: ViewColumn = ViewColumn.Active
) {
  const document = await workspace.openTextDocument(toVsCodeUri(notePath));
  const editor = await window.showTextDocument(document, viewColumn);

  // Move the cursor to end of the file
  if (moveCursorToEnd) {
    const { lineCount } = editor.document;
    const { range } = editor.document.lineAt(lineCount - 1);
    editor.selection = new Selection(range.end, range.end);
  }

  return { document, editor };
}

export function getContainsTooltip(titles: string[]): string {
  const TITLES_LIMIT = 5;
  const ellipsis = titles.length > TITLES_LIMIT ? ',...' : '';
  return `Contains "${titles.slice(0, TITLES_LIMIT).join('", "')}"${ellipsis}`;
}

/**
 * Depending on the current vscode version, returns a MarkdownString of the
 * note content casted as string or returns a simple string
 * MarkdownString is only available from 1.52.1 onwards
 * https://code.visualstudio.com/updates/v1_52#_markdown-tree-tooltip-api
 * @param note A Foam Note
 */
export function getNoteTooltip(content: string): string {
  const STABLE_MARKDOWN_STRING_API_VERSION = '1.52.1';
  const strippedContent = stripFrontMatter(stripImages(content));

  if (version >= STABLE_MARKDOWN_STRING_API_VERSION) {
    return formatMarkdownTooltip(strippedContent) as any;
  }

  return formatSimpleTooltip(strippedContent);
}

export function formatMarkdownTooltip(content: string): MarkdownString {
  const LINES_LIMIT = 16;
  const { excerpt, lines } = getExcerpt(content, LINES_LIMIT);
  const totalLines = content.split('\n').length;
  const diffLines = totalLines - lines;
  const ellipsis = diffLines > 0 ? `\n\n[...] *(+ ${diffLines} lines)*` : '';
  const md = new MarkdownString(`${excerpt}${ellipsis}`);
  md.isTrusted = true;
  return md;
}

export function formatSimpleTooltip(content: string): string {
  const CHARACTERS_LIMIT = 200;
  const flatContent = removeMarkdown(content)
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ');
  const extract = flatContent.substr(0, CHARACTERS_LIMIT);
  const ellipsis = flatContent.length > CHARACTERS_LIMIT ? '...' : '';
  return `${extract}${ellipsis}`;
}

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

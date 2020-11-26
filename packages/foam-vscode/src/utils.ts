import {
  EndOfLine,
  Range,
  TextDocument,
  window,
  Position,
  TextEditor,
  workspace,
  Uri,
  Selection
} from "vscode";
import * as fs from "fs";
import { Logger } from "foam-core";

interface Point {
  line: number;
  column: number;
  offset?: number;
}

export const docConfig = { tab: "  ", eol: "\r\n" };

export const mdDocSelector = [
  { language: "markdown", scheme: "file" },
  { language: "markdown", scheme: "untitled" }
];

export function loadDocConfig() {
  // Load workspace config
  let activeEditor = window.activeTextEditor;
  if (!activeEditor) {
    Logger.debug("Failed to load config, no active editor");
    return;
  }

  docConfig.eol = activeEditor.document.eol === EndOfLine.CRLF ? "\r\n" : "\n";

  let tabSize = Number(activeEditor.options.tabSize);
  let insertSpaces = activeEditor.options.insertSpaces;
  if (insertSpaces) {
    docConfig.tab = " ".repeat(tabSize);
  } else {
    docConfig.tab = "\t";
  }
}

export function isMdEditor(editor: TextEditor) {
  return editor && editor.document && editor.document.languageId === "markdown";
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
      lines: []
    };
  }

  return {
    range: new Range(
      new Position(headerLine, 0),
      new Position(footerLine, lines[footerLine].length + 1)
    ),
    lines: lines.slice(headerLine + 1, footerLine + 1)
  };
}

export function hasEmptyTrailing(doc: TextDocument): boolean {
  return doc.lineAt(doc.lineCount - 1).isEmptyOrWhitespace;
}

export function getText(range: Range): string {
  return window.activeTextEditor.document.getText(range);
}

export function dropExtension(path: string): string {
  const parts = path.split(".");
  parts.pop();
  return parts.join(".");
}

/**
 *
 * @param point ast position (1-indexed)
 * @returns VSCode position  (0-indexed)
 */
export const astPositionToVsCodePosition = (point: Point): Position => {
  return new Position(point.line - 1, point.column - 1);
};

/**
 * Used for the "Copy to Clipboard Without Brackets" command
 *
 */
export function removeBrackets(s: string): string {
  // take in the string, split on space
  const stringSplitBySpace = s.split(" ");

  // loop through words
  const modifiedWords = stringSplitBySpace.map(currentWord => {
    if (currentWord.includes("[[")) {
      // all of these transformations will turn this "[[you-are-awesome]]"
      // to this "you are awesome"
      let word = currentWord.replace(/(\[\[)/g, "");
      word = word.replace(/(\]\])/g, "");
      word = word.replace(/(.mdx|.md|.markdown)/g, "");
      word = word.replace(/[-]/g, " ");

      // then we titlecase the word so "you are awesome"
      // becomes "You Are Awesome"
      const titleCasedWord = toTitleCase(word);

      return titleCasedWord;
    }

    return currentWord;
  });

  return modifiedWords.join(" ");
}

/**
 * Takes in a string and returns it titlecased
 *
 * @example toTitleCase("hello world") -> "Hello World"
 */
export function toTitleCase(word: string): string {
  return word
    .split(" ")
    .map(word => word[0].toUpperCase() + word.substring(1))
    .join(" ");
}

/**
 * Verify the given path exists in the file system
 *
 * @param path The path to verify
 */
export function pathExists(path: string) {
  return fs.promises
    .access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

/**
 * Verify the given object is defined
 *
 * @param value The object to verify
 */
export function isSome<T>(value: T | null | undefined | void): value is T {
  //
  return value != null; // eslint-disable-line
}

/**
 * Verify the given object is not defined
 *
 * @param value The object to verify
 */
export function isNone<T>(
  value: T | null | undefined | void
): value is null | undefined | void {
  return value == null; // eslint-disable-line
}

export async function focusNote(notePath: string, moveCursorToEnd: boolean) {
  const document = await workspace.openTextDocument(Uri.file(notePath));
  const editor = await window.showTextDocument(document);

  // Move the cursor to end of the file
  if (moveCursorToEnd) {
    const { lineCount } = editor.document;
    const { range } = editor.document.lineAt(lineCount - 1);
    editor.selection = new Selection(range.end, range.end);
  }
}

import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  commands,
  EndOfLine,
  ExtensionContext,
  languages,
  Range,
  TextEditor,
  TextDocument,
  TextDocumentWillSaveEvent,
  window,
  workspace,
  Position,
} from "vscode";

export const docConfig = { tab: "  ", eol: "\r\n" };

export const mdDocSelector = [
  { language: "markdown", scheme: "file" },
  { language: "markdown", scheme: "untitled" },
];

export function loadDocConfig() {
  // Load workspace config
  let activeEditor = window.activeTextEditor;
  if (!activeEditor) {
    console.log("Failed to load config, no active editor");
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

export function detectGeneratedCode(fullText: string, header: string, footer: string): {range: Range | null, lines: string[]} {
  const lines = fullText.split(docConfig.eol)

  const headerLine = lines.findIndex(line => line === header)
  const footerLine = lines.findIndex(line => line === footer)

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
  }
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

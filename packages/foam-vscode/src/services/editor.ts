import { isEmpty } from 'lodash';
import {
  EndOfLine,
  FileType,
  RelativePattern,
  Selection,
  SnippetString,
  TextDocument,
  TextEditor,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
  MarkdownString,
} from 'vscode';
import { getExcerpt, stripFrontMatter, stripImages } from '../core/utils/md';
import { isSome } from '../core/utils/core';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { asAbsoluteUri, URI } from '../core/model/uri';
import { getFoamVsCodeConfig } from './config';
import {
  AlwaysIncludeMatcher,
  FileListBasedMatcher,
  GenericDataStore,
  IDataStore,
  IMatcher,
} from '../core/services/datastore';

interface SelectionInfo {
  document: TextDocument;
  selection: Selection;
  content: string;
}

/**
 * Returns a MarkdownString of the note content
 * @param note A Foam Note
 */
export function getNoteTooltip(content: string): string {
  const strippedContent = stripFrontMatter(stripImages(content));
  return formatMarkdownTooltip(strippedContent) as any;
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

// Generate the document selector dynamically
export const getFoamDocSelectors = () =>
  getFoamVsCodeConfig<string[]>('supportedLanguages', ['markdown']).flatMap(
    lang => [
      { language: lang, scheme: 'file' }, // Local files
      { language: lang, scheme: 'vscode-vfs' }, // Remote files
      { language: lang, scheme: 'untitled' }, // Untitled files
    ]
  );

// Check if the editor's document is a supported language
export function isMdEditor(editor: TextEditor): boolean {
  const supportedLanguages = getFoamVsCodeConfig<string[]>(
    'supportedLanguages',
    ['markdown']
  );
  return (
    editor &&
    editor.document &&
    supportedLanguages.includes(editor.document.languageId)
  );
}

/**
 * Check if the workspace contains remote or virtual file system folders.
 * @returns True if the workspace contains remote or virtual file system folders, false otherwise.
 */
export function isVirtualWorkspace(): boolean {
  return workspace.workspaceFolders.some(folder => {
    const scheme = folder.uri.scheme;
    return scheme === 'vscode-remote' || scheme === 'vscode-vfs';
  });
}

export function findSelectionContent(): SelectionInfo | undefined {
  const editor = window.activeTextEditor;
  if (editor === undefined) {
    return undefined;
  }

  const document = editor.document;
  const selection = editor.selection;

  if (!document || selection.isEmpty) {
    return undefined;
  }

  return {
    document,
    selection,
    content: document.getText(selection),
  };
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

export async function createDocAndFocus(
  text: SnippetString,
  filepath: URI,
  viewColumn: ViewColumn = ViewColumn.Active
) {
  await workspace.fs.writeFile(
    toVsCodeUri(filepath),
    new TextEncoder().encode('')
  );
  const note = await focusNote(filepath, true, viewColumn);
  await note.editor.insertSnippet(text);
  await note.document.save();
}

export async function replaceSelection(
  document: TextDocument,
  selection: Selection,
  content: string
) {
  const originatingFileEdit = new WorkspaceEdit();
  originatingFileEdit.replace(document.uri, selection, content);
  await workspace.applyEdit(originatingFileEdit);
}

/**
 * Returns the EOL character for the currently open editor.
 */
export function getEditorEOL(): string {
  return window.activeTextEditor.document.eol === EndOfLine.CRLF
    ? '\r\n'
    : '\n';
}

/**
 * Returns the directory of the file currently open in the editor.
 * If no file is open in the editor it will throw.
 *
 * @returns URI
 * @throws Error if no file is open in editor
 */
export function getCurrentEditorDirectory(): URI {
  const uri = window.activeTextEditor?.document?.uri;

  if (isSome(uri)) {
    return fromVsCodeUri(uri).getDirectory();
  }

  throw new Error('No editor open');
}

export async function fileExists(uri: URI): Promise<boolean> {
  try {
    const stat = await workspace.fs.stat(toVsCodeUri(uri));
    return stat.type === FileType.File;
  } catch (e) {
    return false;
  }
}

export async function readFile(uri: URI): Promise<string | undefined> {
  if (await fileExists(uri)) {
    return workspace.fs
      .readFile(toVsCodeUri(uri))
      .then(bytes => new TextDecoder('utf-8').decode(bytes));
  }
  return undefined;
}

export function deleteFile(uri: URI) {
  return workspace.fs.delete(toVsCodeUri(uri), { recursive: true });
}

/**
 * Turns a relative URI into an absolute URI for the given workspace.
 * @param uriOrPath the uri or path to evaluate
 * @param forceSubfolder if true, if the URI is absolute and not a subfolder in the workspace,
 * it will be forced to be a subfolder of the first workspace folder
 * @returns an absolute uri
 */
export function asAbsoluteWorkspaceUri(
  uriOrPath: URI | string,
  forceSubfolder = false
): URI {
  if (workspace.workspaceFolders === undefined) {
    throw new Error('An open folder or workspace is required');
  }
  const folders = workspace.workspaceFolders.map(folder =>
    fromVsCodeUri(folder.uri)
  );
  const res = asAbsoluteUri(uriOrPath, folders, forceSubfolder);
  return res;
}

export async function createMatcherAndDataStore(excludes: string[]): Promise<{
  matcher: IMatcher;
  dataStore: IDataStore;
  excludePatterns: Map<string, string[]>;
}> {
  const excludePatterns = new Map<string, string[]>();
  workspace.workspaceFolders.forEach(f => excludePatterns.set(f.name, []));

  for (const exclude of excludes) {
    const tokens = exclude.split('/');
    const matchesFolder = workspace.workspaceFolders.find(
      f => f.name === tokens[0]
    );
    if (matchesFolder) {
      excludePatterns.get(tokens[0]).push(tokens.slice(1).join('/'));
    } else {
      for (const [, value] of excludePatterns.entries()) {
        value.push(exclude);
      }
    }
  }

  const listFiles = async () => {
    let files: Uri[] = [];
    for (const folder of workspace.workspaceFolders) {
      const uris = await workspace.findFiles(
        new RelativePattern(folder.uri, '**/*'),
        new RelativePattern(
          folder.uri,
          `{${excludePatterns.get(folder.name).join(',')}}`
        )
      );
      files = [...files, ...uris];
    }

    return files.map(fromVsCodeUri);
  };

  const decoder = new TextDecoder('utf-8');
  const readFile = async (uri: URI) => {
    const content = await workspace.fs.readFile(toVsCodeUri(uri));
    return decoder.decode(content);
  };

  const dataStore = new GenericDataStore(listFiles, readFile);
  const matcher = isEmpty(excludes)
    ? new AlwaysIncludeMatcher()
    : await FileListBasedMatcher.createFromListFn(listFiles);

  return { matcher, dataStore, excludePatterns };
}

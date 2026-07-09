import { isEmpty } from 'lodash';
import {
  Disposable,
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
import { getExcerpt, stripFrontMatter, stripImages } from '@foam/core';
import { isSome } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { asAbsoluteUri, FoamWorkspace, URI } from '@foam/core';
import { getFoamVsCodeConfig } from '../config';
import {
  AlwaysIncludeMatcher,
  FileListBasedMatcher,
  GenericDataStore,
  IDataStore,
  IMatcher,
} from '@foam/core';

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

/**
 * Resolves the URI of the currently active tab, falling back to the active text
 * editor. Supports custom editors and notebooks, whose
 * tab inputs carry a URI but do not surface as text editors.
 *
 * Webview panel tabs  carry no URI at all —
 * the only signal is the tab label, which conventionally contains the file's
 * basename, possibly with a prefix (e.g. "Preview note-a.md").
 * When a workspace is provided, the label (and its space-delimited suffixes
 * that look like a file name) is resolved like a wikilink identifier.
 *
 * Returns `undefined` when the active tab cannot be mapped to a file (settings
 * page, terminal, unrecognized webview, ...). 
 *
 * Exported separately from `getActiveTabUri()` so it can be unit-tested without
 * mocking the `tabGroups` namespace.
 */
export function pickTabUri(
  tab: { input?: unknown; label?: string } | undefined,
  editor: { activeUri?: Uri; visibleUris?: Uri[] } | undefined,
  fWorkspace?: FoamWorkspace
): URI | undefined {
  const input = tab?.input;
  if (
    input &&
    typeof input === 'object' &&
    'uri' in input &&
    input.uri != null
  ) {
    return fromVsCodeUri(input.uri as Uri);
  }
  if (fWorkspace && tab?.label) {
    for (const candidate of labelToFileNameCandidates(tab.label)) {
      const resource = fWorkspace.find(candidate);
      if (resource) {
        return resource.uri;
      }
    }
  }
  if (isBuiltinMarkdownPreview(input) && editor?.visibleUris?.length) {
    const sole = soleMarkdownUri(editor.visibleUris);
    if (sole) {
      return fromVsCodeUri(sole);
    }
  }
  return editor?.activeUri ? fromVsCodeUri(editor.activeUri) : undefined;
}

function isBuiltinMarkdownPreview(input: unknown): boolean {
  return (
    !!input &&
    typeof input === 'object' &&
    'viewType' in input &&
    typeof input.viewType === 'string' &&
    input.viewType.endsWith('markdown.preview')
  );
}

function soleMarkdownUri(uris: Uri[]): Uri | undefined {
  const markdown = uris.filter(u => u.path.endsWith('.md'));
  return markdown.length === 1 ? markdown[0] : undefined;
}

/**
 * Returns the parts of a tab label worth resolving as a file name: the full
 * label first  then progressively shorter space-delimited suffixes — longest (most
 * specific) first, so "Preview my note.md" matches `my note.md` before
 * `note.md`. Suffixes must end with an extension to avoid retargeting on
 * arbitrary webview titles (e.g. "Foam Graph" must not match `Graph.md`).
 */
function labelToFileNameCandidates(label: string): string[] {
  const words = label.split(' ');
  const candidates = [label];
  for (let i = 1; i < words.length; i++) {
    const candidate = words.slice(i).join(' ');
    if (/\.\w+$/.test(candidate)) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

/**
 * Returns the URI of the file shown in the currently active tab, regardless of
 * whether it's opened in a text editor, a custom editor, a notebook, or a
 * webview panel whose label matches a note in the given workspace.
 * Returns `undefined` if the active tab cannot be mapped to a file.
 */
export function getActiveTabUri(fWorkspace?: FoamWorkspace): URI | undefined {
  return pickTabUri(
    window.tabGroups?.activeTabGroup?.activeTab,
    {
      activeUri: window.activeTextEditor?.document.uri,
      visibleUris: window.visibleTextEditors?.map(e => e.document.uri),
    },
    fWorkspace
  );
}

/**
 * Registers a listener invoked whenever the active tab may have changed:
 * the active text editor changed, a tab changed within a group (switching
 * tabs, including custom editors and webviews), or the focused tab group
 * changed (switching between split editor groups — which does not fire
 * `onDidChangeTabs`). Use together with `getActiveTabUri()` to track the
 * note the user is currently on.
 *
 * The listener may fire multiple times per user interaction (opening a file
 * typically fires both `onDidChangeActiveTextEditor` and `onDidChangeTabs`). 
 * Dedupe is delegated to consumers to avoid unnecessary complexity 
 * and overhead when it's not needed.
 */
export function onDidChangeActiveTab(listener: () => void): Disposable {
  const subscriptions = [
    window.onDidChangeActiveTextEditor(() => listener()),
    window.tabGroups.onDidChangeTabs(() => listener()),
    window.tabGroups.onDidChangeTabGroups(() => listener()),
  ];
  return {
    dispose: () => subscriptions.forEach(s => s.dispose()),
  };
}

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

export function getWorkspaceDefaultScheme(): string {
  if (workspace.workspaceFolders === undefined) {
    throw new Error('An open folder or workspace is required');
  }
  return workspace.workspaceFolders[0].uri.scheme;
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

export async function writeFile(uri: URI, content: string): Promise<void> {
  await workspace.fs.createDirectory(toVsCodeUri(uri.getDirectory()));
  await workspace.fs.writeFile(
    toVsCodeUri(uri),
    new TextEncoder().encode(content)
  );
}

/**
 * Turns a relative URI into an absolute URI for the given workspace.
 * @param uriOrPath the uri or path to evaluate
 * @returns an absolute uri
 */
export function asAbsoluteWorkspaceUri(uriOrPath: URI | string): URI {
  if (workspace.workspaceFolders === undefined) {
    throw new Error('An open folder or workspace is required');
  }
  const folders = workspace.workspaceFolders.map(folder =>
    fromVsCodeUri(folder.uri)
  );
  return asAbsoluteUri(uriOrPath, folders);
}

export async function createMatcherAndDataStore(
  includes: string[],
  excludes: string[]
): Promise<{
  matcher: IMatcher;
  dataStore: IDataStore;
  includePatterns: Map<string, string[]>;
  excludePatterns: Map<string, string[]>;
}> {
  const includePatterns = new Map<string, string[]>();
  const excludePatterns = new Map<string, string[]>();
  workspace.workspaceFolders.forEach(f => {
    includePatterns.set(f.name, []);
    excludePatterns.set(f.name, []);
  });

  // Process include patterns
  for (const include of includes) {
    const tokens = include.split('/');
    const matchesFolder = workspace.workspaceFolders.find(
      f => f.name === tokens[0]
    );
    if (matchesFolder) {
      includePatterns.get(tokens[0]).push(tokens.slice(1).join('/'));
    } else {
      for (const [, value] of includePatterns.entries()) {
        value.push(include);
      }
    }
  }

  // Process exclude patterns
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
    // Avoid spreading large arrays as variadic arguments (e.g. `arr.push(...other)`
    // or `[...a, ...b]`): on V8 this overflows the call stack around ~125k items,
    // which is reachable on large vaults with many attachments. See issue #1645.
    const allFiles: Uri[] = [];

    for (const folder of workspace.workspaceFolders) {
      const folderIncludes = includePatterns.get(folder.name);
      const folderExcludes = excludePatterns.get(folder.name);
      const excludePattern =
        folderExcludes.length > 0
          ? new RelativePattern(folder.uri, `{${folderExcludes.join(',')}}`)
          : null;

      // If includes are empty, include nothing
      if (folderIncludes.length === 0) {
        continue;
      }

      // Common case: a single include pattern returns unique URIs from
      // findFiles, so we can skip the per-file dedup work.
      if (folderIncludes.length === 1) {
        const uris = await workspace.findFiles(
          new RelativePattern(folder.uri, folderIncludes[0]),
          excludePattern
        );
        for (const uri of uris) {
          allFiles.push(uri);
        }
        continue;
      }

      const seen = new Map<string, Uri>();

      // Apply each include pattern, deduplicating across patterns
      for (const includePattern of folderIncludes) {
        const uris = await workspace.findFiles(
          new RelativePattern(folder.uri, includePattern),
          excludePattern
        );
        for (const uri of uris) {
          const key = uri.toString();
          if (!seen.has(key)) {
            seen.set(key, uri);
          }
        }
      }

      for (const uri of seen.values()) {
        allFiles.push(uri);
      }
    }

    return allFiles.map(fromVsCodeUri);
  };

  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  const readFile = async (uri: URI) => {
    const content = await workspace.fs.readFile(toVsCodeUri(uri));
    return decoder.decode(content);
  };
  const writeFile = async (uri: URI, content: string) => {
    await workspace.fs.createDirectory(toVsCodeUri(uri.getDirectory()));
    await workspace.fs.writeFile(toVsCodeUri(uri), encoder.encode(content));
  };
  const deleteFile = async (uri: URI) => {
    await workspace.fs.delete(toVsCodeUri(uri));
  };
  const moveFile = async (from: URI, to: URI) => {
    await workspace.fs.createDirectory(toVsCodeUri(to.getDirectory()));
    await workspace.fs.rename(toVsCodeUri(from), toVsCodeUri(to), {
      overwrite: false,
    });
  };
  const fileExists = async (uri: URI) => {
    try {
      await workspace.fs.stat(toVsCodeUri(uri));
      return true;
    } catch {
      return false;
    }
  };

  const dataStore = new GenericDataStore(
    listFiles,
    readFile,
    writeFile,
    deleteFile,
    moveFile,
    fileExists
  );
  const matcher =
    isEmpty(excludes) && includes.length === 1 && includes[0] === '**/*'
      ? new AlwaysIncludeMatcher()
      : await FileListBasedMatcher.createFromListFn(
          listFiles,
          includes,
          excludes
        );

  return { matcher, dataStore, includePatterns, excludePatterns };
}

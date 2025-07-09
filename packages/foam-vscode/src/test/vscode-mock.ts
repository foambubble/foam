/**
 * Mock implementation of VS Code API for testing
 * Reuses existing Foam implementations where possible
 */

import * as fs from 'fs';
import * as path from 'path';
import { Position } from '../core/model/position';
import { Range as FoamRange } from '../core/model/range';
import { URI } from '../core/model/uri';
import { Logger } from '../core/utils/log';
import { TextEdit } from '../core/services/text-edit';

// ===== Basic VS Code Types =====

export { Position };

// VS Code Range class
export class Range implements FoamRange {
  public readonly start: Position;
  public readonly end: Position;

  constructor(start: Position, end: Position);
  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(startOrLine: Position | number, endOrCharacter: Position | number, endLine?: number, endCharacter?: number) {
    if (typeof startOrLine === 'number') {
      this.start = { line: startOrLine, character: endOrCharacter as number };
      this.end = { line: endLine!, character: endCharacter! };
    } else {
      this.start = startOrLine;
      this.end = endOrCharacter as Position;
    }
  }
  
  // Add static methods that were being used by other parts of the code
  static create(startLine: number, startChar: number, endLine?: number, endChar?: number): Range {
    return new Range(startLine, startChar, endLine ?? startLine, endChar ?? startChar);
  }
  
  static createFromPosition(start: Position, end?: Position): Range {
    return new Range(start, end ?? start);
  }
}

// Create VS Code-compatible Uri interface that wraps Foam's URI
export interface Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri;

  toString(): string;
}

// Adapter to convert Foam URI to VS Code Uri
export function createVSCodeUri(foamUri: URI): Uri {
  return {
    scheme: foamUri.scheme,
    authority: foamUri.authority,
    path: foamUri.path,
    query: foamUri.query,
    fragment: foamUri.fragment,
    fsPath: foamUri.toFsPath(),

    with(change) {
      const newFoamUri = foamUri.with(change);
      return createVSCodeUri(newFoamUri);
    },

    toString() {
      return foamUri.toString();
    },
  };
}

// VS Code Uri static methods
export const Uri = {
  file(path: string): Uri {
    return createVSCodeUri(URI.file(path));
  },

  parse(value: string): Uri {
    return createVSCodeUri(URI.parse(value));
  },

  from(components: {
    scheme: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri {
    // Create URI from components
    const uriString = `${components.scheme}://${components.authority || ''}${
      components.path || ''
    }${components.query ? '?' + components.query : ''}${
      components.fragment ? '#' + components.fragment : ''
    }`;
    return createVSCodeUri(URI.parse(uriString));
  },

  joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const baseUri = URI.parse(base.toString());
    return createVSCodeUri(baseUri.joinPath(...pathSegments));
  },
};

// Selection extends Range
export class Selection implements Range {
  public readonly anchor: Position;
  public readonly active: Position;

  constructor(anchor: Position, active: Position);
  constructor(
    anchorLine: number,
    anchorCharacter: number,
    activeLine: number,
    activeCharacter: number
  );
  constructor(
    anchorOrLine: Position | number,
    activeOrCharacter: Position | number,
    activeLine?: number,
    activeCharacter?: number
  ) {
    let anchor: Position;
    let active: Position;

    if (typeof anchorOrLine === 'number') {
      anchor = { line: anchorOrLine, character: activeOrCharacter as number };
      active = { line: activeLine!, character: activeCharacter! };
    } else {
      anchor = anchorOrLine;
      active = activeOrCharacter as Position;
    }

    this.anchor = anchor;
    this.active = active;
  }

  get start(): Position {
    return Position.isBefore(this.anchor, this.active)
      ? this.anchor
      : this.active;
  }

  get end(): Position {
    return Position.isAfter(this.anchor, this.active)
      ? this.anchor
      : this.active;
  }

  get isReversed(): boolean {
    return Position.isAfter(this.anchor, this.active);
  }

  get isEmpty(): boolean {
    return Position.isEqual(this.anchor, this.active);
  }
}

// Basic enums
export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

// ===== SnippetString =====

export class SnippetString {
  public readonly value: string;

  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(string: string): SnippetString {
    return new SnippetString(this.value + string);
  }

  appendTabstop(number?: number): SnippetString {
    return new SnippetString(this.value + `$${number || 0}`);
  }

  appendPlaceholder(
    value: string | ((snippet: SnippetString) => void),
    number?: number
  ): SnippetString {
    const placeholder = typeof value === 'string' ? value : '';
    return new SnippetString(this.value + `\${${number || 1}:${placeholder}}`);
  }

  appendChoice(values: string[], number?: number): SnippetString {
    return new SnippetString(
      this.value + `\${${number || 1}|${values.join(',')}|}`
    );
  }

  appendVariable(
    name: string,
    defaultValue: string | ((snippet: SnippetString) => void)
  ): SnippetString {
    const def = typeof defaultValue === 'string' ? defaultValue : '';
    return new SnippetString(this.value + `\${${name}:${def}}`);
  }
}

// ===== Configuration =====

export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  has(section: string): boolean;
  inspect<T>(section: string):
    | {
        key: string;
        defaultValue?: T;
        globalValue?: T;
        workspaceValue?: T;
        workspaceFolderValue?: T;
      }
    | undefined;
  update(
    section: string,
    value: any,
    configurationTarget?: any
  ): Thenable<void>;
  readonly [key: string]: any;
}

class MockWorkspaceConfiguration implements WorkspaceConfiguration {
  private _config: Map<string, any> = new Map();

  get<T>(section: string, defaultValue?: T): T {
    return this._config.get(section) ?? defaultValue;
  }

  has(section: string): boolean {
    return this._config.has(section);
  }

  inspect<T>(section: string):
    | {
        key: string;
        defaultValue?: T;
        globalValue?: T;
        workspaceValue?: T;
        workspaceFolderValue?: T;
      }
    | undefined {
    return {
      key: section,
      workspaceValue: this._config.get(section),
    };
  }

  async update(
    section: string,
    value: any,
    configurationTarget?: any
  ): Promise<void> {
    this._config.set(section, value);
  }

  [key: string]: any;
}

// ===== Document Management =====

export interface TextLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly range: Range;
  readonly rangeIncludingLineBreak: Range;
  readonly firstNonWhitespaceCharacterIndex: number;
  readonly isEmptyOrWhitespace: boolean;
}

export interface TextDocument {
  readonly uri: Uri;
  readonly fileName: string;
  readonly isUntitled: boolean;
  readonly languageId: string;
  readonly version: number;
  readonly isDirty: boolean;
  readonly isClosed: boolean;
  readonly eol: EndOfLine;
  readonly lineCount: number;

  save(): Thenable<boolean>;
  getText(range?: Range): string;
  lineAt(line: number): TextLine;
  lineAt(position: Position): TextLine;
  offsetAt(position: Position): number;
  positionAt(offset: number): Position;
  validatePosition(position: Position): Position;
  validateRange(range: Range): Range;
  getWordRangeAtPosition(position: Position): Range | undefined;
}

class MockTextDocument implements TextDocument {
  public readonly uri: Uri;
  public readonly fileName: string;
  public readonly isUntitled: boolean = false;
  public readonly languageId: string = 'markdown';
  public readonly version: number = 1;
  public readonly isDirty: boolean = false;
  public readonly isClosed: boolean = false;
  public readonly eol: EndOfLine = EndOfLine.LF;

  private _content: string = '';
  private _lines: string[] = [];

  constructor(uri: Uri, content?: string) {
    this.uri = uri;
    this.fileName = uri.fsPath;

    if (content !== undefined) {
      this._content = content;
      // Write the content to file if provided
      try {
        const dir = path.dirname(uri.fsPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(uri.fsPath, content);
      } catch (error) {
        // Ignore write errors in mock
      }
    } else {
      // Try to read from file system
      try {
        this._content = fs.readFileSync(uri.fsPath, 'utf8');
      } catch {
        this._content = '';
      }
    }

    this._lines = this._content.split(/\r?\n/);
  }

  get lineCount(): number {
    return Math.max(1, this._lines.length);
  }

  async save(): Promise<boolean> {
    try {
      await fs.promises.writeFile(this.uri.fsPath, this._content);
      return true;
    } catch {
      return false;
    }
  }

  getText(range?: Range): string {
    if (!range) {
      return this._content;
    }

    const startOffset = this.offsetAt(range.start);
    const endOffset = this.offsetAt(range.end);
    return this._content.substring(startOffset, endOffset);
  }

  lineAt(lineOrPosition: number | Position): TextLine {
    const lineNumber =
      typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
    const text = this._lines[lineNumber] || '';
    const range = Range.create(lineNumber, 0, lineNumber, text.length);
    const rangeIncludingLineBreak = Range.create(
      lineNumber,
      0,
      lineNumber + 1,
      0
    );

    return {
      lineNumber,
      text,
      range,
      rangeIncludingLineBreak,
      firstNonWhitespaceCharacterIndex: text.search(/\S/),
      isEmptyOrWhitespace: text.trim().length === 0,
    };
  }

  offsetAt(position: Position): number {
    let offset = 0;
    for (let i = 0; i < position.line && i < this._lines.length; i++) {
      offset += this._lines[i].length + 1; // +1 for newline
    }
    return (
      offset +
      Math.min(position.character, this._lines[position.line]?.length || 0)
    );
  }

  positionAt(offset: number): Position {
    let currentOffset = 0;
    for (let line = 0; line < this._lines.length; line++) {
      const lineLength = this._lines[line].length;
      if (currentOffset + lineLength >= offset) {
        return Position.create(line, offset - currentOffset);
      }
      currentOffset += lineLength + 1; // +1 for newline
    }
    return Position.create(
      this._lines.length - 1,
      this._lines[this._lines.length - 1]?.length || 0
    );
  }

  validatePosition(position: Position): Position {
    const line = Math.max(0, Math.min(position.line, this.lineCount - 1));
    const character = Math.max(
      0,
      Math.min(position.character, this._lines[line]?.length || 0)
    );
    return Position.create(line, character);
  }

  validateRange(range: Range): Range {
    const start = this.validatePosition(range.start);
    const end = this.validatePosition(range.end);
    return Range.createFromPosition(start, end);
  }

  getWordRangeAtPosition(position: Position): Range | undefined {
    const line = this._lines[position.line];
    if (!line) return undefined;

    const wordRegex = /\w+/g;
    let match;
    while ((match = wordRegex.exec(line)) !== null) {
      const start = Position.create(position.line, match.index);
      const end = Position.create(position.line, match.index + match[0].length);
      if (
        Position.isBeforeOrEqual(start, position) &&
        Position.isAfterOrEqual(end, position)
      ) {
        return Range.createFromPosition(start, end);
      }
    }
    return undefined;
  }

  // Internal method to update content
  _updateContent(content: string): void {
    this._content = content;
    this._lines = content.split(/\r?\n/);
    // Write the content to file immediately so it persists
    try {
      const dir = path.dirname(this.uri.fsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.uri.fsPath, content);
    } catch (error) {
      Logger.error('vscode-mock: Failed to write file', error);
    }
  }
}

export interface TextEditor {
  readonly document: TextDocument;
  selection: Selection;
  selections: Selection[];
  readonly visibleRanges: Range[];
  readonly viewColumn: ViewColumn | undefined;

  edit(callback: (editBuilder: any) => void): Thenable<boolean>;
  insertSnippet(snippet: any): Thenable<boolean>;
  setDecorations(decorationType: any, ranges: Range[]): void;
  revealRange(range: Range): void;
  show(column?: ViewColumn): void;
  hide(): void;
}

class MockTextEditor implements TextEditor {
  public readonly document: TextDocument;
  public selection: Selection;
  public selections: Selection[];
  public readonly visibleRanges: Range[] = [];
  public readonly viewColumn: ViewColumn | undefined;

  constructor(document: TextDocument, viewColumn?: ViewColumn) {
    this.document = document;
    this.viewColumn = viewColumn;
    this.selection = new Selection(0, 0, 0, 0);
    this.selections = [this.selection];
  }

  async edit(callback: (editBuilder: any) => void): Promise<boolean> {
    // Simplified edit implementation
    return true;
  }

  async insertSnippet(snippet: any): Promise<boolean> {
    // Insert snippet at current selection
    if (snippet && typeof snippet === 'object' && snippet.value) {
      const text = snippet.value;
      const document = this.document as MockTextDocument;

      // Replace selection with snippet text
      const startOffset = document.offsetAt(this.selection.start);
      const endOffset = document.offsetAt(this.selection.end);
      let content = document.getText();
      content =
        content.substring(0, startOffset) + text + content.substring(endOffset);

      document._updateContent(content);

      // Move cursor to end of inserted text
      const newPosition = document.positionAt(startOffset + text.length);
      this.selection = new Selection(newPosition, newPosition);
      this.selections = [this.selection];
    }
    return true;
  }

  setDecorations(decorationType: any, ranges: Range[]): void {
    // No-op for mock
  }

  revealRange(range: Range): void {
    // No-op for mock
  }

  show(column?: ViewColumn): void {
    // No-op for mock
  }

  hide(): void {
    // No-op for mock
  }
}

// ===== WorkspaceEdit =====

export class WorkspaceEdit {
  private _edits: Map<string, any[]> = new Map();

  replace(uri: Uri, range: Range, newText: string): void {
    const key = uri.toString();
    if (!this._edits.has(key)) {
      this._edits.set(key, []);
    }
    this._edits.get(key)!.push({ type: 'replace', range, newText });
  }

  insert(uri: Uri, position: Position, newText: string): void {
    const key = uri.toString();
    if (!this._edits.has(key)) {
      this._edits.set(key, []);
    }
    this._edits.get(key)!.push({ type: 'insert', position, newText });
  }

  delete(uri: Uri, range: Range): void {
    const key = uri.toString();
    if (!this._edits.has(key)) {
      this._edits.set(key, []);
    }
    this._edits.get(key)!.push({ type: 'delete', range });
  }

  // Internal method to get edits for applying
  _getEdits(): Map<string, any[]> {
    return this._edits;
  }

  get size(): number {
    return this._edits.size;
  }
}

// ===== FileSystem Mock =====

export interface FileSystem {
  readFile(uri: Uri): Thenable<Uint8Array>;
  writeFile(uri: Uri, content: Uint8Array): Thenable<void>;
  delete(uri: Uri, options?: { recursive?: boolean }): Thenable<void>;
  stat(
    uri: Uri
  ): Thenable<{ type: number; size: number; mtime: number; ctime: number }>;
  readDirectory(uri: Uri): Thenable<[string, number][]>;
  createDirectory(uri: Uri): Thenable<void>;
  copy(
    source: Uri,
    target: Uri,
    options?: { overwrite?: boolean }
  ): Thenable<void>;
  rename(
    source: Uri,
    target: Uri,
    options?: { overwrite?: boolean }
  ): Thenable<void>;
}

class MockFileSystem implements FileSystem {
  async readFile(uri: Uri): Promise<Uint8Array> {
    const content = await fs.promises.readFile(uri.fsPath);
    return new Uint8Array(content);
  }

  async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(uri.fsPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(uri.fsPath, content);
  }

  async delete(uri: Uri, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      // Use rmdir with recursive option for older Node.js versions
      try {
        await fs.promises.rmdir(uri.fsPath, { recursive: true });
      } catch {
        // Fallback for very old Node.js versions
        await fs.promises.unlink(uri.fsPath);
      }
    } else {
      await fs.promises.unlink(uri.fsPath);
    }
  }

  async stat(
    uri: Uri
  ): Promise<{ type: number; size: number; mtime: number; ctime: number }> {
    const stats = await fs.promises.stat(uri.fsPath);
    return {
      type: stats.isFile() ? 1 : stats.isDirectory() ? 2 : 0,
      size: stats.size,
      mtime: stats.mtime.getTime(),
      ctime: stats.ctime.getTime(),
    };
  }

  async readDirectory(uri: Uri): Promise<[string, number][]> {
    const entries = await fs.promises.readdir(uri.fsPath, {
      withFileTypes: true,
    });
    return entries.map(entry => [
      entry.name,
      entry.isFile() ? 1 : entry.isDirectory() ? 2 : 0,
    ]);
  }

  async createDirectory(uri: Uri): Promise<void> {
    await fs.promises.mkdir(uri.fsPath, { recursive: true });
  }

  async copy(
    source: Uri,
    target: Uri,
    options?: { overwrite?: boolean }
  ): Promise<void> {
    await fs.promises.copyFile(source.fsPath, target.fsPath);
  }

  async rename(
    source: Uri,
    target: Uri,
    options?: { overwrite?: boolean }
  ): Promise<void> {
    await fs.promises.rename(source.fsPath, target.fsPath);
  }
}

// ===== Workspace Folder =====

export interface WorkspaceFolder {
  readonly uri: Uri;
  readonly name: string;
  readonly index: number;
}

// ===== VS Code Namespaces =====

// Global state
const mockState = {
  activeTextEditor: undefined as TextEditor | undefined,
  visibleTextEditors: [] as TextEditor[],
  workspaceFolders: [] as WorkspaceFolder[],
  commands: new Map<string, (...args: any[]) => any>(),
  fileSystem: new MockFileSystem(),
  configuration: new MockWorkspaceConfiguration(),
};

// Window namespace
export const window = {
  get activeTextEditor(): TextEditor | undefined {
    return mockState.activeTextEditor;
  },

  set activeTextEditor(editor: TextEditor | undefined) {
    mockState.activeTextEditor = editor;
  },

  get visibleTextEditors(): TextEditor[] {
    return mockState.visibleTextEditors;
  },

  async showInputBox(options?: {
    value?: string;
    prompt?: string;
    placeHolder?: string;
    password?: boolean;
    validateInput?: (value: string) => string | undefined;
  }): Promise<string | undefined> {
    // This will be mocked in tests
    return undefined;
  },

  async showTextDocument(
    documentOrUri: TextDocument | Uri,
    options?: {
      viewColumn?: ViewColumn;
      preserveFocus?: boolean;
      preview?: boolean;
      selection?: Range;
    }
  ): Promise<TextEditor> {
    let document: TextDocument;

    if ('uri' in documentOrUri) {
      document = documentOrUri;
    } else {
      document = await workspace.openTextDocument(documentOrUri);
    }

    const editor = new MockTextEditor(document, options?.viewColumn);

    if (options?.selection) {
      editor.selection = new Selection(
        options.selection.start,
        options.selection.end
      );
      editor.selections = [editor.selection];
    }

    mockState.activeTextEditor = editor;

    if (!mockState.visibleTextEditors.includes(editor)) {
      mockState.visibleTextEditors.push(editor);
    }

    return editor;
  },
};

// Workspace namespace
export const workspace = {
  get workspaceFolders(): WorkspaceFolder[] | undefined {
    return mockState.workspaceFolders.length > 0
      ? mockState.workspaceFolders
      : undefined;
  },

  get fs(): FileSystem {
    return mockState.fileSystem;
  },

  getConfiguration(section?: string): WorkspaceConfiguration {
    if (section) {
      // Return a scoped configuration for the specific section
      const scopedConfig = new MockWorkspaceConfiguration();
      // Copy relevant config values that start with the section
      for (const [key, value] of (mockState.configuration as any)._config) {
        if (key.startsWith(`${section}.`)) {
          const sectionKey = key.substring(section.length + 1);
          (scopedConfig as any)._config.set(sectionKey, value);
        }
      }
      return scopedConfig;
    }
    return mockState.configuration;
  },

  async openTextDocument(
    uriOrFileNameOrOptions:
      | Uri
      | string
      | { language?: string; content?: string }
  ): Promise<TextDocument> {
    let uri: Uri;
    let content: string | undefined;

    if (typeof uriOrFileNameOrOptions === 'string') {
      uri = createVSCodeUri(URI.file(uriOrFileNameOrOptions));
    } else if ('scheme' in uriOrFileNameOrOptions) {
      uri = uriOrFileNameOrOptions;
    } else {
      // Create untitled document
      uri = createVSCodeUri(URI.parse(`untitled:Untitled-${Date.now()}`));
      content = uriOrFileNameOrOptions.content || '';
    }

    // Always create a fresh document to ensure we get the latest content
    const document = new MockTextDocument(uri, content);
    return document;
  },

  async applyEdit(edit: WorkspaceEdit): Promise<boolean> {
    try {
      for (const [uriString, edits] of edit._getEdits()) {
        const uri = createVSCodeUri(URI.parse(uriString));
        const document = await workspace.openTextDocument(uri);

        if (document instanceof MockTextDocument) {
          let content = document.getText();

          // Apply edits in reverse order to maintain positions
          const sortedEdits = edits.sort((a, b) => {
            if (a.type === 'replace' && b.type === 'replace') {
              return Position.compareTo(b.range.start, a.range.start);
            }
            // Add more sophisticated sorting for other edit types
            return 0;
          });

          for (const edit of sortedEdits) {
            if (edit.type === 'replace') {
              content = TextEdit.apply(content, {
                newText: edit.newText,
                range: edit.range,
              });
            }
            // Handle other edit types as needed
          }

          document._updateContent(content);
        }
      }

      return true;
    } catch (e) {
      Logger.error('vscode-mock: Failed to apply edit', e);
      return false;
    }
  },
};

// Commands namespace
export const commands = {
  registerCommand(
    command: string,
    callback: (...args: any[]) => any
  ): { dispose(): void } {
    mockState.commands.set(command, callback);
    return {
      dispose() {
        mockState.commands.delete(command);
      },
    };
  },

  async executeCommand<T = unknown>(
    command: string,
    ...args: any[]
  ): Promise<T> {
    const handler = mockState.commands.get(command);
    if (!handler) {
      throw new Error(`Command '${command}' not found`);
    }

    return handler(...args);
  },
};

// ===== Initialization Helper =====

export function initializeWorkspace(workspaceRoot: string): void {
  const uri = createVSCodeUri(URI.file(workspaceRoot));
  const folder: WorkspaceFolder = {
    uri,
    name: path.basename(workspaceRoot),
    index: 0,
  };

  mockState.workspaceFolders = [folder];
}

// ===== Utility Functions =====

export function createUri(fsPath: string): Uri {
  return createVSCodeUri(URI.file(fsPath));
}

// Clean up state for tests
export function resetMockState(): void {
  mockState.activeTextEditor = undefined;
  mockState.visibleTextEditors = [];
  mockState.workspaceFolders = [];
  mockState.commands.clear();

  // Register built-in VS Code commands
  commands.registerCommand('workbench.action.closeAllEditors', () => {
    // Reset active editor to simulate closing all editors
    (window as any).activeTextEditor = undefined;
    return Promise.resolve();
  });

  commands.registerCommand('vscode.open', async uri => {
    // Mock opening a file - just show it in editor
    return window.showTextDocument(uri);
  });

  mockState.configuration = new MockWorkspaceConfiguration();
}

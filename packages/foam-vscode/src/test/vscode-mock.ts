/**
 * Mock implementation of VS Code API for testing
 * Reuses existing Foam implementations where possible
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Position } from '../core/model/position';
import { Range as FoamRange } from '../core/model/range';
import { URI } from '../core/model/uri';
import { Logger } from '../core/utils/log';
import { TextEdit } from '../core/services/text-edit';
import * as foamCommands from '../features/commands';
import { Foam, bootstrap } from '../core/model/foam';
import { createMarkdownParser } from '../core/services/markdown-parser';
import {
  GenericDataStore,
  AlwaysIncludeMatcher,
} from '../core/services/datastore';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { randomString } from './test-utils';
import micromatch from 'micromatch';

interface Thenable<T> {
  then<TResult>(
    onfulfilled?: (value: T) => TResult | Thenable<TResult>,
    onrejected?: (reason: any) => TResult | Thenable<TResult>
  ): Thenable<TResult>;
  then<TResult>(
    onfulfilled?: (value: T) => TResult | Thenable<TResult>,
    onrejected?: (reason: any) => void
  ): Thenable<TResult>;
}

// ===== Basic VS Code Types =====

export { Position };

// VS Code Range class
export class Range implements FoamRange {
  public readonly start: Position;
  public readonly end: Position;

  constructor(start: Position, end: Position);
  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number
  );
  constructor(
    startOrLine: Position | number,
    endOrCharacter: Position | number,
    endLine?: number,
    endCharacter?: number
  ) {
    if (typeof startOrLine === 'number') {
      this.start = { line: startOrLine, character: endOrCharacter as number };
      this.end = { line: endLine!, character: endCharacter! };
    } else {
      this.start = startOrLine;
      this.end = endOrCharacter as Position;
    }
  }

  // Add static methods that were being used by other parts of the code
  static create(
    startLine: number,
    startChar: number,
    endLine?: number,
    endChar?: number
  ): Range {
    return new Range(
      startLine,
      startChar,
      endLine ?? startLine,
      endChar ?? startChar
    );
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
  toJSON(): any;
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

    toJSON() {
      return {
        scheme: foamUri.scheme,
        authority: foamUri.authority,
        path: foamUri.path,
        query: foamUri.query,
        fragment: foamUri.fragment,
        fsPath: foamUri.toFsPath(),
      };
    },
  };
}

// VS Code Uri static methods
// eslint-disable-next-line @typescript-eslint/no-redeclare
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
export class Selection extends Range {
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
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
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

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

// ===== Code Actions =====

export class CodeActionKind {
  public static readonly QuickFix = new CodeActionKind('quickfix');
  public static readonly Refactor = new CodeActionKind('refactor');
  public static readonly RefactorExtract = new CodeActionKind(
    'refactor.extract'
  );
  public static readonly RefactorInline = new CodeActionKind('refactor.inline');
  public static readonly RefactorMove = new CodeActionKind('refactor.move');
  public static readonly RefactorRewrite = new CodeActionKind(
    'refactor.rewrite'
  );
  public static readonly Source = new CodeActionKind('source');
  public static readonly SourceOrganizeImports = new CodeActionKind(
    'source.organizeImports'
  );
  public static readonly SourceFixAll = new CodeActionKind('source.fixAll');

  constructor(public readonly value: string) {}
}

export class CodeAction {
  public title: string;
  public edit?: WorkspaceEdit;
  public diagnostics?: any[];
  public kind?: CodeActionKind;
  public command?: any;
  public isPreferred?: boolean;
  public disabled?: { reason: string };

  constructor(title: string, kind?: CodeActionKind) {
    this.title = title;
    this.kind = kind;
  }
}

// ===== Completion Items =====

export class CompletionItem {
  public label: string;
  public kind?: CompletionItemKind;
  public detail?: string;
  public documentation?: string;
  public sortText?: string;
  public filterText?: string;
  public insertText?: string;
  public range?: Range;
  public command?: any;
  public textEdit?: any;
  public additionalTextEdits?: any[];

  constructor(label: string, kind?: CompletionItemKind) {
    this.label = label;
    this.kind = kind;
  }
}

export class CompletionList {
  public isIncomplete: boolean;
  public items: CompletionItem[];

  constructor(items: CompletionItem[] = [], isIncomplete = false) {
    this.items = items;
    this.isIncomplete = isIncomplete;
  }
}

// ===== Hover =====

export class MarkdownString {
  public value: string;
  public isTrusted?: boolean;

  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(value: string, language?: string): MarkdownString {
    this.value += `\`\`\`${language || ''}\n${value}\n\`\`\``;
    return this;
  }
}

export class Hover {
  public contents: (MarkdownString | string)[];
  public range?: Range;

  constructor(
    contents: (MarkdownString | string)[] | MarkdownString | string,
    range?: Range
  ) {
    if (Array.isArray(contents)) {
      this.contents = contents;
    } else {
      this.contents = [contents];
    }
    this.range = range;
  }
}

// ===== Tree Items =====

export class TreeItem {
  public label?: string;
  public id?: string;
  public iconPath?: string | Uri | { light: string | Uri; dark: string | Uri };
  public description?: string;
  public tooltip?: string;
  public command?: any;
  public collapsibleState?: number;
  public contextValue?: string;
  public resourceUri?: Uri;

  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

// ===== Theme Classes =====

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class ThemeIcon {
  public readonly id: string;
  public readonly color?: ThemeColor;

  constructor(id: string, color?: ThemeColor) {
    this.id = id;
    this.color = color;
  }

  static readonly File = new ThemeIcon('file');
  static readonly Folder = new ThemeIcon('folder');
}

// ===== Event System =====

export interface Event<T> {
  (listener: (e: T) => any, thisArg?: any): { dispose(): void };
}

export interface Disposable {
  dispose(): void;
}

export class EventEmitter<T> {
  private listeners: ((e: T) => any)[] = [];

  get event(): Event<T> {
    return (listener: (e: T) => any, thisArg?: any) => {
      const boundListener = thisArg ? listener.bind(thisArg) : listener;
      this.listeners.push(boundListener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(boundListener);
          if (index >= 0) {
            this.listeners.splice(index, 1);
          }
        },
      };
    };
  }

  fire(data: T): void {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  dispose(): void {
    this.listeners = [];
  }
}

// ===== Diagnostics =====

export class Diagnostic {
  public range: Range;
  public message: string;
  public severity: DiagnosticSeverity;
  public source?: string;
  public code?: string | number;
  public relatedInformation?: any[];

  constructor(range: Range, message: string, severity?: DiagnosticSeverity) {
    this.range = range;
    this.message = message;
    this.severity = severity || DiagnosticSeverity.Error;
  }
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
  [key: string]: any;
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

  update(
    section: string,
    value: any,
    configurationTarget?: any
  ): Thenable<void> {
    this._config.set(section, value);
    return Promise.resolve();
  }
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
    // simplify by always returning the full content for now
    return this._content;
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

  renameFile(
    oldUri: Uri,
    newUri: Uri,
    options?: { overwrite?: boolean; ignoreIfExists?: boolean }
  ): void {
    const key = oldUri.toString();
    if (!this._edits.has(key)) {
      this._edits.set(key, []);
    }
    this._edits.get(key)!.push({ type: 'rename', oldUri, newUri, options });
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

// ===== Extension Context =====

export interface ExtensionContext {
  subscriptions: Disposable[];
  workspaceState: any;
  globalState: any;
  extensionPath: string;
  extensionUri: Uri;
  storageUri: Uri | undefined;
  globalStorageUri: Uri;
  logUri: Uri;
  secrets: any;
  environmentVariableCollection: any;
  asAbsolutePath(relativePath: string): string;
  storagePath: string | undefined;
  globalStoragePath: string;
  logPath: string;
  extensionMode: number;
  extension: any;
}

function createMockExtensionContext(): ExtensionContext {
  return {
    subscriptions: [],
    workspaceState: {
      get: () => undefined,
      update: () => Promise.resolve(),
    },
    globalState: {
      get: () => undefined,
      update: () => Promise.resolve(),
    },
    extensionPath: '/mock/extension/path',
    extensionUri: createVSCodeUri(URI.parse('file:///mock/extension/path')),
    storageUri: undefined,
    globalStorageUri: createVSCodeUri(URI.parse('file:///mock/global/storage')),
    logUri: createVSCodeUri(URI.parse('file:///mock/logs')),
    secrets: {
      get: () => Promise.resolve(undefined),
      store: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    },
    environmentVariableCollection: {
      clear: () => {},
      get: () => undefined,
      set: () => {},
      delete: () => {},
    },
    asAbsolutePath: (relativePath: string) =>
      path.join('/mock/extension/path', relativePath),
    storagePath: '/mock/storage',
    globalStoragePath: '/mock/global/storage',
    logPath: '/mock/logs',
    extensionMode: 1,
    extension: {
      id: 'foam.foam-vscode',
      packageJSON: {},
    },
  };
}

// ===== Foam Commands Lazy Initialization =====

class TestFoam {
  private static instance: Foam | null = null;

  static async getInstance(): Promise<Foam> {
    if (!TestFoam.instance) {
      TestFoam.instance = await TestFoam.bootstrap();
    }
    return TestFoam.instance;
  }

  static async bootstrap(): Promise<Foam> {
    const workspaceFolder = mockState.workspaceFolders[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder available for mock Foam');
    }

    // Create real file system implementations
    const listFiles = async (): Promise<URI[]> => {
      // Recursively find all markdown files in the workspace
      const findMarkdownFiles = async (dir: string): Promise<URI[]> => {
        const files: URI[] = [];
        try {
          const entries = await fs.promises.readdir(dir, {
            withFileTypes: true,
          });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              const subFiles = await findMarkdownFiles(fullPath);
              files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              files.push(URI.file(fullPath));
            }
          }
        } catch (error) {
          // Ignore errors accessing directories
        }

        return files;
      };

      return findMarkdownFiles(workspaceFolder.uri.fsPath);
    };

    const readFile = async (uri: URI): Promise<string> => {
      try {
        return await fs.promises.readFile(uri.toFsPath(), 'utf8');
      } catch (error) {
        Logger.debug(`Failed to read file ${uri.toString()}: ${error}`);
        return '';
      }
    };

    // Create services
    const dataStore = new GenericDataStore(listFiles, readFile);
    const parser = createMarkdownParser();
    const matcher = new AlwaysIncludeMatcher(); // Accept all markdown files

    // Create resource providers
    const providers = [new MarkdownResourceProvider(dataStore, parser)];

    // Use the bootstrap function without file watcher (simpler for tests)
    const foam = await bootstrap(
      matcher,
      undefined,
      dataStore,
      parser,
      providers,
      '.md'
    );

    Logger.info('Mock Foam instance created (manual reload for tests)');
    return foam;
  }

  static async reloadFoamWorkspace(): Promise<void> {
    // Simple reload: clear workspace and reload all files
    TestFoam.instance.workspace.clear();

    // Re-read all markdown files from the filesystem
    const files = await TestFoam.instance.services.dataStore.list();
    for (const file of files) {
      await TestFoam.instance.workspace.fetchAndSet(file);
    }

    TestFoam.instance.graph.update();
    TestFoam.instance.tags.update();

    Logger.debug(`Reloaded workspace with ${files.length} files`);
  }

  static dispose() {
    if (TestFoam.instance) {
      try {
        TestFoam.instance.dispose();
      } catch (error) {
        // Ignore disposal errors
      }
      TestFoam.instance = null;
    }
  }
}

async function initializeFoamCommands(foam: Foam): Promise<void> {
  const mockContext = createMockExtensionContext();

  const foamPromise = Promise.resolve(foam);
  // Initialize all command modules
  // Commands that need Foam instance
  await foamCommands.createNote(mockContext, foamPromise);
  await foamCommands.janitorCommand(mockContext, foamPromise);
  await foamCommands.openRandomNoteCommand(mockContext, foamPromise);
  await foamCommands.openResource(mockContext, foamPromise);
  await foamCommands.updateGraphCommand(mockContext, foamPromise);
  await foamCommands.updateWikilinksCommand(mockContext, foamPromise);
  await foamCommands.generateStandaloneNote(mockContext, foamPromise);
  await foamCommands.openDailyNoteForDateCommand(mockContext, foamPromise);

  // Commands that only need context
  await foamCommands.copyWithoutBracketsCommand(mockContext);
  await foamCommands.createFromTemplateCommand(mockContext);
  await foamCommands.createNewTemplate(mockContext);
  await foamCommands.openDailyNoteCommand(mockContext, foamPromise);
  await foamCommands.openDatedNote(mockContext, foamPromise);

  Logger.info('Foam commands initialized successfully in mock environment');
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

  async showQuickPick(items: any[], options?: any): Promise<any> {
    throw new Error(
      'showQuickPick not implemented - should be mocked in tests'
    );
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

  async showInformationMessage(
    message: string,
    ...items: string[]
  ): Promise<string | undefined> {
    // Mock implementation - do nothing
    return undefined;
  },

  async showWarningMessage(
    message: string,
    ...items: string[]
  ): Promise<string | undefined> {
    // Mock implementation - do nothing
    return undefined;
  },

  async showErrorMessage(
    message: string,
    ...items: string[]
  ): Promise<string | undefined> {
    // Mock implementation - do nothing
    return undefined;
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

  async findFiles(
    include: string,
    exclude?: string,
    maxResults?: number
  ): Promise<Uri[]> {
    // Simple implementation that recursively finds files
    const workspaceFolder = mockState.workspaceFolders[0];

    if (!workspaceFolder) {
      return [];
    }

    const findFilesRecursive = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(
            workspaceFolder.uri.fsPath,
            fullPath
          );

          if (entry.isDirectory()) {
            const subFiles = await findFilesRecursive(fullPath);
            files.push(...subFiles);
          } else if (entry.isFile()) {
            // Check if file matches include pattern
            if (micromatch.isMatch(relativePath, include)) {
              // Check if file matches exclude pattern
              if (!exclude || !micromatch.isMatch(relativePath, exclude)) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Ignore errors accessing directories
      }

      return files;
    };

    try {
      const files = await findFilesRecursive(workspaceFolder.uri.fsPath);

      let result = files.map(file => createVSCodeUri(URI.file(file)));

      if (maxResults && result.length > maxResults) {
        result = result.slice(0, maxResults);
      }

      return result;
    } catch (error) {
      return [];
    }
  },

  getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined {
    const workspaceFolder = mockState.workspaceFolders.find(folder =>
      uri.fsPath.startsWith(folder.uri.fsPath)
    );
    return workspaceFolder;
  },

  onWillSaveTextDocument(listener: (e: any) => void): Disposable {
    // Mock event listener for document save events
    return {
      dispose: () => {
        // No-op
      },
    };
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
            } else if (edit.type === 'rename') {
              // Handle file rename by physically moving the file
              await fs.promises.rename(edit.oldUri.fsPath, edit.newUri.fsPath);
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

  asRelativePath(
    pathOrUri: string | Uri,
    includeWorkspaceFolder?: boolean
  ): string {
    const workspaceFolder = mockState.workspaceFolders[0];
    if (!workspaceFolder) {
      return typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    }

    const fsPath = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    const relativePath = path.relative(workspaceFolder.uri.fsPath, fsPath);

    if (includeWorkspaceFolder) {
      return `${workspaceFolder.name}/${relativePath}`;
    }

    return relativePath;
  },

  get isTrusted(): boolean {
    // Mock workspace as trusted for testing
    return true;
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
    // Auto-initialize Foam commands if this is a foam-vscode command
    if (command.startsWith('foam-vscode.')) {
      await initializeFoamCommands(await TestFoam.getInstance());
    }

    const handler = mockState.commands.get(command);
    if (!handler) {
      throw new Error(`Command '${command}' not found`);
    }

    return handler(...args);
  },
};

// Languages namespace
export const languages = {
  registerCodeLensProvider(selector: any, provider: any): Disposable {
    // Mock code lens provider registration
    return {
      dispose: () => {
        // No-op
      },
    };
  },
};

// Env namespace
export const env = {
  __mockClipboard: '',
  clipboard: {
    async writeText(value: string): Promise<void> {
      env.__mockClipboard = value;
    },

    async readText(): Promise<string> {
      return env.__mockClipboard || '';
    },
  },

  // Other common env properties
  appName: 'Visual Studio Code',
  appRoot: '/mock/vscode',
  language: 'en',
  sessionId: 'mock-session',
  machineId: 'mock-machine',
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

// Clean up state for tests
export function resetMockState(): void {
  // Clean up existing Foam instance
  TestFoam.dispose();
  mockState.activeTextEditor = undefined;
  mockState.visibleTextEditors = [];
  mockState.workspaceFolders = [];
  mockState.commands.clear();
  mockState.configuration = new MockWorkspaceConfiguration();

  // Create a default workspace folder for tests
  const defaultWorkspaceRoot = path.join(
    os.tmpdir(),
    'foam-mock-workspace-' + randomString(3)
  );
  fs.mkdirSync(defaultWorkspaceRoot, { recursive: true });

  initializeWorkspace(defaultWorkspaceRoot);

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

  commands.registerCommand('setContext', (key: string, value: any) => {
    // Mock command for setting VS Code context
    return Promise.resolve();
  });
}

// Initialize the mock state when the module is loaded
resetMockState();

// ===== Force Cleanup for Test Files =====

export async function forceCleanup(): Promise<void> {
  // Clean up existing Foam instance
  TestFoam.dispose();

  // Clear all registered commands
  mockState.commands.clear();

  // Clear all event listeners by resetting emitters
  mockState.activeTextEditor = undefined;
  mockState.visibleTextEditors = [];

  // Close any open file handles by clearing the file system
  mockState.fileSystem = new MockFileSystem();

  // Clear configuration
  mockState.configuration = new MockWorkspaceConfiguration();

  // Force garbage collection
  if (global.gc) {
    global.gc();
  }

  // Wait for any pending file system operations to complete
  await new Promise(resolve => setTimeout(resolve, 10));
}

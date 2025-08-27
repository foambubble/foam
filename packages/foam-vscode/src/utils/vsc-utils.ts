import {
  Memento,
  Position,
  Range,
  Uri,
  TextEdit,
  WorkspaceEdit,
  commands,
} from 'vscode';
import { Position as FoamPosition } from '../core/model/position';
import { Range as FoamRange } from '../core/model/range';
import { URI as FoamURI } from '../core/model/uri';
import {
  TextEdit as FoamTextEdit,
  WorkspaceTextEdit,
} from '../core/services/text-edit';
import { FoamWorkspace } from '../core/model/workspace/foamWorkspace';
import { Logger } from '../core/utils/log';

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

export const toVsCodeUri = (u: FoamURI): Uri => Uri.from(u);

export const fromVsCodeUri = (u: Uri): FoamURI =>
  FoamURI.parse(u.toString(), null);

export const toVsCodeTextEdit = (edit: FoamTextEdit): TextEdit =>
  new TextEdit(toVsCodeRange(edit.range), edit.newText);

/**
 * Convert WorkspaceTextEdit array to VS Code WorkspaceEdit.
 *
 * @param workspaceTextEdits Array of workspace text edits to convert
 * @param workspace Foam workspace for URI resolution
 * @returns VS Code WorkspaceEdit ready for application
 */
export const toVsCodeWorkspaceEdit = (
  workspaceTextEdits: WorkspaceTextEdit[],
  workspace: FoamWorkspace
): WorkspaceEdit => {
  const workspaceEdit = new WorkspaceEdit();

  // Group edits by URI
  const editsByUri = new Map<string, { uri: Uri; edits: TextEdit[] }>();

  for (const workspaceTextEdit of workspaceTextEdits) {
    const resource = workspace.get(workspaceTextEdit.uri);
    if (!resource) {
      Logger.warn(
        `Could not resolve resource: ${workspaceTextEdit.uri.toString()}`
      );
      continue;
    }

    const vscodeUri = toVsCodeUri(resource.uri);
    const uriKey = resource.uri.toString();
    const existingEntry = editsByUri.get(uriKey) || {
      uri: vscodeUri,
      edits: [],
    };

    const vscodeEdit = new TextEdit(
      toVsCodeRange(workspaceTextEdit.edit.range),
      workspaceTextEdit.edit.newText
    );

    existingEntry.edits.push(vscodeEdit);
    editsByUri.set(uriKey, existingEntry);
  }

  // Apply grouped edits to workspace
  for (const { uri, edits } of editsByUri.values()) {
    workspaceEdit.set(uri, edits);
  }

  return workspaceEdit;
};

/**
 * A class that wraps context value, syncs it via setContext, and provides a typed interface to it.
 */
export class ContextMemento<T> {
  constructor(
    private data: Memento,
    private key: string,
    defaultValue: T,
    resetToDefault: boolean = false
  ) {
    resetToDefault && this.data.update(this.key, defaultValue);
    const value = data.get(key) ?? defaultValue;
    commands.executeCommand('setContext', this.key, value);
  }
  public get(): T {
    return this.data.get(this.key);
  }
  public async update(value: T): Promise<void> {
    this.data.update(this.key, value);
    await commands.executeCommand('setContext', this.key, value);
  }
}

/**
 * Implementation of the Memento interface that uses a Map as backend
 */
export class MapBasedMemento implements Memento {
  get<T>(key: unknown, defaultValue?: unknown | T): T | T {
    return (this.map.get(key as string) as T) || (defaultValue as T);
  }
  private map: Map<string, string> = new Map();
  keys(): readonly string[] {
    return Array.from(this.map.keys());
  }
  update(key: string, value: any): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }
}

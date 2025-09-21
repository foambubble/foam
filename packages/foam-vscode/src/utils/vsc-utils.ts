import { Memento, Position, Range, Uri, TextEdit, commands } from 'vscode';
import { Position as FoamPosition } from '../core/model/position';
import { Range as FoamRange } from '../core/model/range';
import { URI as FoamURI } from '../core/model/uri';
import { TextEdit as FoamTextEdit } from '../core/services/text-edit';

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

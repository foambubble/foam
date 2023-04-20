import { Memento, Position, Range, Uri, commands } from 'vscode';
import { Position as FoamPosition } from '../core/model/position';
import { Range as FoamRange } from '../core/model/range';
import { URI as FoamURI } from '../core/model/uri';

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

export const toVsCodeUri = (u: FoamURI): Uri => Uri.parse(u.toString());

export const fromVsCodeUri = (u: Uri): FoamURI => FoamURI.parse(u.toString());

/**
 * A class that wraps context value, syncs it via setContext, and provides a typed interface to it.
 */
export class ContextMemento<T> {
  constructor(private data: Memento, private key: string, defaultValue: T) {
    const value = data.get(key) ?? defaultValue;
    commands.executeCommand('setContext', this.key, value);
  }
  public get(): T {
    return this.data.get(this.key);
  }
  public update(value: T): Thenable<void> {
    this.data.update(this.key, value);
    return commands.executeCommand('setContext', this.key, value);
  }
}

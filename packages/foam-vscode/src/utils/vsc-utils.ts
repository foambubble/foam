import { Position, Range } from 'vscode';
import { Position as FoamPosition, Range as FoamRange } from 'foam-core';

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

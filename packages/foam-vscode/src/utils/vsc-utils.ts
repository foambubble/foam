import { Position, Range, Uri } from 'vscode';
import {
  Position as FoamPosition,
  Range as FoamRange,
  URI as FoamURI,
} from 'foam-core';

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

export const toVsCodeUri = (u: FoamURI): Uri => Uri.parse(FoamURI.toString(u));

export const fromVsCodeUri = (u: Uri): FoamURI => FoamURI.parse(u.toString());

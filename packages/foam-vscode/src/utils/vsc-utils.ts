import { Position, Range, Uri } from 'vscode';
import { Position as FoamPosition } from '../core/model/position';
import { Range as FoamRange } from '../core/model/range';
import { URI as FoamURI } from '../core/model/uri';

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

export const toVsCodeUri = (u: FoamURI): Uri => Uri.parse(u.toString());

export const fromVsCodeUri = (u: Uri): FoamURI => FoamURI.parse(u.toString());

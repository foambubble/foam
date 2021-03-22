import { Position, Range, Uri, workspace } from 'vscode';
import os from 'os';
import {
  Position as FoamPosition,
  Range as FoamRange,
  URI as FoamURI,
} from 'foam-core';

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

const isWindows = os.platform() === 'win32';
const isWindowsDriveLetterUppercase = isWindows
  ? workspace.workspaceFolders[0].uri.fsPath[0] in
    Array.from('ABCDEFGHIJKLMNPQRSTUVWXYZ')
  : undefined;

export const toVsCodeUri = (u: FoamURI): Uri =>
  u.scheme === 'file' ? Uri.file(u.path) : Uri.parse(FoamURI.toString(u));

export const fromVsCodeUri = (u: Uri): FoamURI => FoamURI.create(u);

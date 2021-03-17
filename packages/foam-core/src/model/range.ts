import { Position } from './position';
import * as pos from './position';

export interface Range {
  start: Position;
  end: Position;
}

export const create = (
  startLine: number,
  startChar: number,
  endLine?: number,
  endChar?: number
): Range => {
  const start: Position = {
    line: startLine,
    character: startChar,
  };
  const end: Position = {
    line: endLine ?? startLine,
    character: endChar ?? startChar,
  };
  return createFromPosition(start, end);
};

export const createFromPosition = (start: Position, end?: Position) => {
  end = end ?? start;
  let first = start;
  let second = end;
  if (pos.isAfter(start, end)) {
    first = end;
    second = start;
  }
  return {
    start: {
      line: first.line,
      character: first.character,
    },
    end: {
      line: second.line,
      character: second.character,
    },
  };
};

export const containsRange = (range: Range, contained: Range): boolean =>
  containsPosition(range, contained.start) &&
  containsPosition(range, contained.end);

export const containsPosition = (range: Range, position: Position): boolean =>
  pos.isAfterOrEqual(position, range.start) &&
  pos.isBeforeOrEqual(position, range.end);

export const isEqual = (r1: Range, r2: Range): boolean =>
  pos.isEqual(r1.start, r2.start) && pos.isEqual(r1.end, r2.end);

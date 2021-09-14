// Some code in this file coming from https://github.com/microsoft/vscode/
// See LICENSE for details

import { Position } from './position';

export interface Range {
  start: Position;
  end: Position;
}

export abstract class Range {
  static create(
    startLine: number,
    startChar: number,
    endLine?: number,
    endChar?: number
  ): Range {
    const start: Position = {
      line: startLine,
      character: startChar,
    };
    const end: Position = {
      line: endLine ?? startLine,
      character: endChar ?? startChar,
    };
    return Range.createFromPosition(start, end);
  }

  static createFromPosition(start: Position, end?: Position) {
    end = end ?? start;
    let first = start;
    let second = end;
    if (Position.isAfter(start, end)) {
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
  }

  static containsRange(range: Range, contained: Range): boolean {
    return (
      Range.containsPosition(range, contained.start) &&
      Range.containsPosition(range, contained.end)
    );
  }

  static containsPosition(range: Range, position: Position): boolean {
    return (
      Position.isAfterOrEqual(position, range.start) &&
      Position.isBeforeOrEqual(position, range.end)
    );
  }

  static isEqual(r1: Range, r2: Range): boolean {
    return (
      Position.isEqual(r1.start, r2.start) && Position.isEqual(r1.end, r2.end)
    );
  }

  static isBefore(a: Range, b: Range): number {
    return a.start.line - b.start.line || a.start.character - b.start.character;
  }
}

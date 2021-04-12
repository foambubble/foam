// Some code in this file coming from https://github.com/microsoft/vscode/
// See LICENSE for details

export interface Position {
  line: number;
  character: number;
}

export abstract class Position {
  static create(line: number, character: number): Position {
    return { line, character };
  }

  static Min(...positions: Position[]): Position {
    if (positions.length === 0) {
      throw new TypeError();
    }
    let result = positions[0];
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i];
      if (Position.isBefore(p, result!)) {
        result = p;
      }
    }
    return result;
  }

  static Max(...positions: Position[]): Position {
    if (positions.length === 0) {
      throw new TypeError();
    }
    let result = positions[0];
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i];
      if (Position.isAfter(p, result!)) {
        result = p;
      }
    }
    return result;
  }

  static isBefore(p1: Position, p2: Position): boolean {
    if (p1.line < p2.line) {
      return true;
    }
    if (p2.line < p1.line) {
      return false;
    }
    return p1.character < p2.character;
  }

  static isBeforeOrEqual(p1: Position, p2: Position): boolean {
    if (p1.line < p2.line) {
      return true;
    }
    if (p2.line < p1.line) {
      return false;
    }
    return p1.character <= p2.character;
  }

  static isAfter(p1: Position, p2: Position): boolean {
    return !Position.isBeforeOrEqual(p1, p2);
  }

  static isAfterOrEqual(p1: Position, p2: Position): boolean {
    return !Position.isBefore(p1, p2);
  }

  static isEqual(p1: Position, p2: Position): boolean {
    return p1.line === p2.line && p1.character === p2.character;
  }

  static compareTo(p1: Position, p2: Position): number {
    if (p1.line < p2.line) {
      return -1;
    } else if (p1.line > p2.line) {
      return 1;
    } else {
      // equal line
      if (p1.character < p2.character) {
        return -1;
      } else if (p1.character > p2.character) {
        return 1;
      } else {
        // equal line and character
        return 0;
      }
    }
  }
}

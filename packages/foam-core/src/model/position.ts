export interface Position {
  line: number;
  character: number;
}

export const create = (line: number, character: number): Position => ({
  line,
  character,
});

export const Min = (...positions: Position[]): Position => {
  if (positions.length === 0) {
    throw new TypeError();
  }
  let result = positions[0];
  for (let i = 1; i < positions.length; i++) {
    const p = positions[i];
    if (isBefore(p, result!)) {
      result = p;
    }
  }
  return result;
};

export const Max = (...positions: Position[]): Position => {
  if (positions.length === 0) {
    throw new TypeError();
  }
  let result = positions[0];
  for (let i = 1; i < positions.length; i++) {
    const p = positions[i];
    if (isAfter(p, result!)) {
      result = p;
    }
  }
  return result;
};

export const isBefore = (p1: Position, p2: Position): boolean => {
  if (p1.line < p2.line) {
    return true;
  }
  if (p2.line < p1.line) {
    return false;
  }
  return p1.character < p2.character;
};

export const isBeforeOrEqual = (p1: Position, p2: Position): boolean => {
  if (p1.line < p2.line) {
    return true;
  }
  if (p2.line < p1.line) {
    return false;
  }
  return p1.character <= p2.character;
};

export const isAfter = (p1: Position, p2: Position): boolean => {
  return !isBeforeOrEqual(p1, p2);
};

export const isAfterOrEqual = (p1: Position, p2: Position): boolean => {
  return !isBefore(p1, p2);
};

export const isEqual = (p1: Position, p2: Position): boolean => {
  return p1.line === p2.line && p1.character === p2.character;
};

export const compareTo = (p1: Position, p2: Position): number => {
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
};

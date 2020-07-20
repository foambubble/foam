import { applyTextEdit } from '../src/utils/apply-text-edit';

describe('applyTextEdit', () => {
  it('should return text with applied TextEdit in the end of the string', () => {
    const textEdit = {
      newText: `\n    4. this is fourth line`,
      range: {
        start: { line: 3, column: 1, offset: 79 },
        end: { line: 3, column: 1, offset: 79 },
      },
    };

    const text = `
    1. this is first line
    2. this is second line
    3. this is third line
    `;

    const expected = `
    1. this is first line
    2. this is second line
    3. this is third line
    4. this is fourth line
    `;

    const actual = applyTextEdit(text, textEdit);

    expect(actual).toBe(expected);
  });

  it('should return text with applied TextEdit at the top of the string', () => {
    const textEdit = {
      newText: `\n    1. this is first line`,
      range: {
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
      },
    };

    const text = `
    2. this is second line
    3. this is third line
    `;

    const expected = `
    1. this is first line
    2. this is second line
    3. this is third line
    `;

    const actual = applyTextEdit(text, textEdit);

    expect(actual).toBe(expected);
  });

  it('should return text with applied TextEdit in the middle of the string', () => {
    const textEdit = {
      newText: `\n    2. this is the updated second line`,
      range: {
        start: { line: 0, column: 0, offset: 26 },
        end: { line: 0, column: 0, offset: 53 },
      },
    };

    const text = `
    1. this is first line
    2. this is second line
    3. this is third line
    `;

    const expected = `
    1. this is first line
    2. this is the updated second line
    3. this is third line
    `;

    const actual = applyTextEdit(text, textEdit);

    expect(actual).toBe(expected);
  });
});

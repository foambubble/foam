import { Range } from '../model/range';
import { Logger } from '../utils/log';
import { TextEdit } from './text-edit';

Logger.setLevel('error');

describe('applyTextEdit', () => {
  it('should return text with applied TextEdit in the end of the string', () => {
    const textEdit = {
      newText: `4. this is fourth line`,
      range: Range.create(4, 0, 4, 0),
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
4. this is fourth line`;

    const actual = TextEdit.apply(text, textEdit);

    expect(actual).toBe(expected);
  });

  it('should return text with applied TextEdit at the top of the string', () => {
    const textEdit = {
      newText: `1. this is first line\n`,
      range: Range.create(1, 0, 1, 0),
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

    const actual = TextEdit.apply(text, textEdit);

    expect(actual).toBe(expected);
  });

  it('should return text with applied TextEdit in the middle of the string', () => {
    const textEdit = {
      newText: `2. this is the updated second line`,
      range: Range.create(2, 0, 2, 100),
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

    const actual = TextEdit.apply(text, textEdit);

    expect(actual).toBe(expected);
  });

  it('should apply multiple TextEdits in reverse order (VS Code behavior)', () => {
    // This test shows why reverse order is important for range stability
    const textEdits = [
      // Edit near beginning - would affect later ranges if applied first
      {
        newText: `[PREFIX] `,
        range: Range.create(0, 0, 0, 0),
      },
      // Edit in middle - range stays valid with reverse order
      {
        newText: `[MIDDLE] `,
        range: Range.create(0, 11, 0, 11),
      },
      // Edit at end - applied first, doesn't affect other ranges
      {
        newText: ` [END]`,
        range: Range.create(0, 15, 0, 15),
      },
    ];

    const text = `this is my text`;
    const expected = `[PREFIX] this is my [MIDDLE] text [END]`;

    const actual = TextEdit.apply(text, textEdits);

    expect(actual).toBe(expected);
  });
});

import { Range } from '../model/range';
import { Logger } from '../utils/log';
import { applyTextEdit } from './apply-text-edit';

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

    const actual = applyTextEdit(text, textEdit);

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

    const actual = applyTextEdit(text, textEdit);

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

    const actual = applyTextEdit(text, textEdit);

    expect(actual).toBe(expected);
  });
});

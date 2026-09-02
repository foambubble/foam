import { Range } from '../model/range';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';
import { TextEdit, WorkspaceTextEdit } from './text-edit';

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

describe('WorkspaceTextEdit.groupByUri', () => {
  it('groups edits by URI while preserving URI and edit order', () => {
    const firstUri = URI.file('/workspace/first.md');
    const secondUri = URI.file('/workspace/second.md');
    const firstEdit = {
      newText: 'a',
      range: Range.create(0, 0, 0, 0),
    };
    const secondEdit = {
      newText: 'b',
      range: Range.create(1, 0, 1, 0),
    };
    const thirdEdit = {
      newText: 'c',
      range: Range.create(0, 0, 0, 0),
    };

    const groups = WorkspaceTextEdit.groupByUri([
      { uri: firstUri, edit: firstEdit },
      { uri: secondUri, edit: thirdEdit },
      { uri: firstUri, edit: secondEdit },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].uri).toBe(firstUri);
    expect(groups[0].edits).toEqual([firstEdit, secondEdit]);
    expect(groups[1].uri).toBe(secondUri);
    expect(groups[1].edits).toEqual([thirdEdit]);
  });
});

describe('applying multiple TextEdits', () => {
  it('applies an identical duplicated edit only once', () => {
    // Two reference links sharing one definition produce the same edit twice;
    // applying both would insert the text twice
    const edit = { newText: 'X', range: Range.create(0, 3, 0, 3) };
    const actual = TextEdit.apply('abc', [edit, { ...edit }]);
    expect(actual).toBe('abcX');
  });

  it('throws on overlapping edits instead of corrupting the text', () => {
    const edits = [
      { newText: 'X', range: Range.create(0, 0, 0, 7) },
      { newText: 'Y', range: Range.create(0, 4, 0, 13) },
    ];
    expect(() => TextEdit.apply('one two three', edits)).toThrow(/overlap/);
  });

  it('lets an edit that rewrites a whole region supersede edits contained in it', () => {
    // e.g. generateLinkReferences: deleting a stale definition line inside
    // the region that the "append definitions" edit replaces wholesale
    const text = 'keep\nstale\nold-tail';
    const edits = [
      { newText: '', range: Range.create(1, 0, 2, 0) },
      { newText: '\nnew-tail', range: Range.create(0, 4, 2, 8) },
    ];
    expect(TextEdit.apply(text, edits)).toBe('keep\nnew-tail');
  });

  it('allows adjacent edits that touch at a boundary', () => {
    const edits = [
      { newText: 'X', range: Range.create(0, 0, 0, 3) },
      { newText: 'Y', range: Range.create(0, 3, 0, 6) },
    ];
    expect(TextEdit.apply('abcdef', edits)).toBe('XY');
  });
});

describe('WorkspaceTextEdit.dedupe', () => {
  it('drops edits with the same uri, range and text, keeping distinct ones', () => {
    const uri = URI.file('/note.md');
    const edit = { newText: 'X', range: Range.create(0, 0, 0, 1) };
    const other = { newText: 'Y', range: Range.create(1, 0, 1, 1) };
    const deduped = WorkspaceTextEdit.dedupe([
      { uri, edit },
      { uri, edit: { ...edit } },
      { uri, edit: other },
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map(e => e.edit.newText)).toEqual(['X', 'Y']);
  });
});

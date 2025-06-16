import { extractBlockIds, isInFrontMatter, isOnYAMLKeywordLine } from './md';

describe('isInFrontMatter', () => {
  it('is true for started front matter', () => {
    const content = `---

`;
    const actual = isInFrontMatter(content, 1);
    expect(actual).toBeTruthy();
  });
  it('is true for inside completed front matter', () => {
    const content = '---\ntitle: A title\n---\n';
    const actual = isInFrontMatter(content, 1);
    expect(actual).toBeTruthy();
  });
  it('is true for inside completed front matter with "..." end delimiter', () => {
    const content = '---\ntitle: A title\n...\n';
    const actual = isInFrontMatter(content, 1);
    expect(actual).toBeTruthy();
  });
  it('is false for non valid front matter delimiter #1347', () => {
    const content = '---\ntitle: A title\n-..\n\n\n---\ntest\n';
    expect(isInFrontMatter(content, 1)).toBeTruthy();
    expect(isInFrontMatter(content, 4)).toBeTruthy();
    expect(isInFrontMatter(content, 6)).toBeFalsy();
  });
  it('is false for outside completed front matter', () => {
    const content = '---\ntitle: A title\n---\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 3);
    expect(actual).toBeFalsy();
  });
  it('is false for outside completed front matter with "..." end delimiter', () => {
    const content = '---\ntitle: A title\n...\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 3);
    expect(actual).toBeFalsy();
  });
  it('is false for position on initial front matter delimiter', () => {
    const content = '---\ntitle: A title\n---\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 0);
    expect(actual).toBeFalsy();
  });
  it('is false for position on final front matter delimiter', () => {
    const content = '---\ntitle: A title\n---\ncontent\nmore content\n';
    const actual = isInFrontMatter(content, 2);
    expect(actual).toBeFalsy();
  });

  describe('isOnYAMLKeywordLine', () => {
    it('is true if line starts with keyword', () => {
      const content = 'tags: foo, bar\n';
      const actual = isOnYAMLKeywordLine(content, 'tags');
      expect(actual).toBeTruthy();
    });
    it('is true if previous line starts with keyword', () => {
      const content = 'tags: foo\n - bar\n';
      const actual = isOnYAMLKeywordLine(content, 'tags');
      expect(actual).toBeTruthy();
    });
    it('is false if line starts with wrong keyword', () => {
      const content = 'tags: foo, bar\n';
      const actual = isOnYAMLKeywordLine(content, 'title');
      expect(actual).toBeFalsy();
    });
    it('is false if previous line starts with wrong keyword', () => {
      const content = 'dates:\n - 2023-01-1\n - 2023-01-02\n';
      const actual = isOnYAMLKeywordLine(content, 'tags');
      expect(actual).toBeFalsy();
    });
  });

  describe('Block ID extraction', () => {
    it('should extract block IDs from paragraphs', () => {
      const content = `This is a paragraph. ^block-id-1
This is another paragraph. ^block-id-2`;
      const expected = [
        { id: 'block-id-1', line: 0, col: 21 },
        { id: 'block-id-2', line: 1, col: 27 },
      ];
      const actual = extractBlockIds(content);
      expect(actual).toEqual(expected);
    });

    it('should extract block IDs from list items', () => {
      const content = `- List item 1 ^list-id-1
  - Nested list item ^nested-id
- List item 2 ^list-id-2`;
      const expected = [
        { id: 'list-id-1', line: 0, col: 14 },
        { id: 'nested-id', line: 1, col: 21 },
        { id: 'list-id-2', line: 2, col: 14 },
      ];
      const actual = extractBlockIds(content);
      expect(actual).toEqual(expected);
    });

    it('should not extract block IDs if not at end of line', () => {
      const content = `This is a paragraph ^block-id-1 with more text.`;
      const expected = [];
      const actual = extractBlockIds(content);
      expect(actual).toEqual(expected);
    });

    it('should handle multiple block IDs on the same line (only last one counts)', () => {
      const content = `This is a paragraph ^block-id-1 ^block-id-2`;
      const expected = [{ id: 'block-id-2', line: 0, col: 32 }];
      const actual = extractBlockIds(content);
      expect(actual).toEqual(expected);
    });

    it('should handle block IDs with special characters', () => {
      const content = `Paragraph with special chars ^block_id-with.dots`;
      const expected = [{ id: 'block_id-with.dots', line: 0, col: 29 }];
      const actual = extractBlockIds(content);
      expect(actual).toEqual(expected);
    });
  });
});

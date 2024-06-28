import { isInFrontMatter, isOnYAMLKeywordLine } from './md';

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
});

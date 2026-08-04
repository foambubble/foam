import { isInFrontMatter, isOnYAMLKeywordLine, stripFrontMatter } from './md';

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

describe('stripFrontMatter', () => {
  // Must not rely on gray-matter: it needs Node's Buffer at call time,
  // which crashes non-Node runtimes (React Native / Hermes).
  it('removes a frontmatter block from the start of the document', () => {
    const md = `---
title: My Note
tags: [a, b]
---

# Heading

Body text.`;
    expect(stripFrontMatter(md)).toBe('# Heading\n\nBody text.');
  });

  it('returns trimmed content when there is no frontmatter', () => {
    expect(stripFrontMatter('# Heading\n\nText\n')).toBe('# Heading\n\nText');
  });

  it('handles an empty frontmatter block', () => {
    expect(stripFrontMatter('---\n---\n# Title')).toBe('# Title');
  });

  it('leaves a thematic break that is not at the start alone', () => {
    const md = 'Intro\n\n---\n\nMore text';
    expect(stripFrontMatter(md)).toBe(md);
  });

  it('does not treat an unclosed opening delimiter as frontmatter', () => {
    const md = '---\ntitle: Unclosed\n\n# Heading';
    expect(stripFrontMatter(md)).toBe(md);
  });

  it('keeps a second --- line in the body (only the first block is frontmatter)', () => {
    const md = `---
title: T
---
Body

---

After break`;
    expect(stripFrontMatter(md)).toBe('Body\n\n---\n\nAfter break');
  });
});

import {
  isInFrontMatter,
  isOnYAMLKeywordLine,
  removeBrackets,
  toTitleCase,
} from './utils';

describe('removeBrackets', () => {
  it('removes the brackets', () => {
    const input = 'hello world [[this-is-it]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets and the md file extension', () => {
    const input = 'hello world [[this-is-it.md]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets and the mdx file extension', () => {
    const input = 'hello world [[this-is-it.mdx]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets and the markdown file extension', () => {
    const input = 'hello world [[this-is-it.markdown]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets even with numbers', () => {
    const input = 'hello world [[2020-07-21.markdown]]';
    const actual = removeBrackets(input);
    const expected = 'hello world 2020 07 21';
    expect(actual).toEqual(expected);
  });
  it('removes brackets for more than one word', () => {
    const input =
      'I am reading this as part of the [[book-club]] put on by [[egghead]] folks (Lauro).';
    const actual = removeBrackets(input);
    const expected =
      'I am reading this as part of the Book Club put on by Egghead folks (Lauro).';
    expect(actual).toEqual(expected);
  });
});

describe('toTitleCase', () => {
  it('title cases a word', () => {
    const input =
      'look at this really long sentence but I am calling it a word';
    const actual = toTitleCase(input);
    const expected =
      'Look At This Really Long Sentence But I Am Calling It A Word';
    expect(actual).toEqual(expected);
  });
  it('works on one word', () => {
    const input = 'word';
    const actual = toTitleCase(input);
    const expected = 'Word';
    expect(actual).toEqual(expected);
  });
});

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

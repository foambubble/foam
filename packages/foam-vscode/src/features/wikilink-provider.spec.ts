import { Range } from 'foam-core';
import { findFirstLineOfContent } from './wikilink-provider';

describe('findFirstLineOfContent', () => {
  it('Should return first line if content start at first line', () => {
    const content =
      'First line 123\n' + // 14 characters
      'second line\n' +
      'third line\n' +
      'last line';
    expect(findFirstLineOfContent(content)).toEqual(Range.create(0, 0, 0, 14));
  });

  it('Should return the first line with printable characters', () => {
    const content = `

First content on third line

Other line with content

Last line with content

`;
    expect(findFirstLineOfContent(content)).toEqual(Range.create(2, 0, 2, 27));
  });

  it('Should skip the leading and trailing white spaces', () => {
    const content =
      '\n\t First content surrounded by white spaces \t\n' +
      'Other line with content\n' +
      'Last line with content';
    expect(findFirstLineOfContent(content)).toEqual(Range.create(1, 2, 1, 42));
  });

  it('Should skip the YAML frontmatter', () => {
    const content = `---
type: feature
keywords: hello world
---

 # This is the Title #

Other line with content
Last line with content
`;
    expect(findFirstLineOfContent(content)).toEqual(Range.create(5, 1, 5, 22));
  });

  it('Should detect the first line just after the YAML frontmatter', () => {
    const content = `---
type: feature
keywords: hello world
---
 First content just after the frontmatter
Other line with content
Last line with content
`;
    expect(findFirstLineOfContent(content)).toEqual(Range.create(4, 1, 4, 41));
  });

  it('Should return an empty range at first position if content is only white-space characters', () => {
    const content = '\n  \n  \n  \t\n \t\t \n';
    expect(findFirstLineOfContent(content)).toEqual(Range.create(0, 0, 0, 0));
  });
});

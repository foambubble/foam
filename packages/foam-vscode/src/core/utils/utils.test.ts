import { extractHashtags } from './index';
import { Logger } from './log';

Logger.setLevel('error');

describe('hashtag extraction', () => {
  it('returns empty list if no tags are present', () => {
    expect(extractHashtags('hello world')).toEqual([]);
  });
  it('works with simple strings', () => {
    expect(
      extractHashtags('hello #world on #this planet').map(t => t.label)
    ).toEqual(['world', 'this']);
  });
  it('detects the offset of the tag', () => {
    expect(extractHashtags('#hello')).toEqual([{ label: 'hello', offset: 0 }]);
    expect(extractHashtags(' #hello')).toEqual([{ label: 'hello', offset: 1 }]);
    expect(extractHashtags('to #hello')).toEqual([
      { label: 'hello', offset: 3 },
    ]);
  });
  it('works with tags at beginning or end of text', () => {
    expect(
      extractHashtags('#hello world on this #planet').map(t => t.label)
    ).toEqual(['hello', 'planet']);
  });
  it('supports _ and -', () => {
    expect(
      extractHashtags('#hello-world on #this_planet').map(t => t.label)
    ).toEqual(['hello-world', 'this_planet']);
  });
  it('supports nested tags', () => {
    expect(
      extractHashtags('#parent/child on #planet').map(t => t.label)
    ).toEqual(['parent/child', 'planet']);
  });
  it('ignores tags that only have numbers in text', () => {
    expect(
      extractHashtags('this #123 tag should be ignore, but not #123four').map(
        t => t.label
      )
    ).toEqual(['123four']);
  });
  it('supports unicode letters like Chinese charaters', () => {
    expect(
      extractHashtags(`
        this #tag_with_unicode_letters_汉字, pure Chinese tag like #纯中文标签 and 
        other mixed tags like #标签1 #123四 should work
      `).map(t => t.label)
    ).toEqual([
      'tag_with_unicode_letters_汉字',
      '纯中文标签',
      '标签1',
      '123四',
    ]);
  });

  it('ignores hashes in plain text urls and links', () => {
    expect(
      extractHashtags(`
        test text with url https://site.com/#section1 https://site.com/home#section2 and
        https://site.com/home/#section3a
        [link](https://site.com/#section4) with [link2](https://site.com/home#section5) #control
        hello world
      `).map(t => t.label)
    ).toEqual(['control']);
  });

  it('ignores hashes in links to sections', () => {
    expect(
      extractHashtags(`
      this is a wikilink to [[#section1]] in the file and a [[link#section2]] in another
      this is a [link](#section3) to a section
      `)
    ).toEqual([]);
  });
});

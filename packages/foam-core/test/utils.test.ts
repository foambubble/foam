import {
  uriToSlug,
  uriToHash,
  computeRelativeURI,
  parseWithReference,
} from '../src/model/uri';
import { extractHashtags } from '../src/utils';
import * as uris from '../src/model/uri';
import { Logger } from '../src/utils/log';

Logger.setLevel('error');

describe('URI utils', () => {
  it('supports various cases', () => {
    expect(uriToSlug(uris.file('/this/is/a/path.md'))).toEqual('path');
    expect(uriToSlug(uris.file('../a/relative/path.md'))).toEqual('path');
    expect(uriToSlug(uris.file('another/relative/path.md'))).toEqual('path');
    expect(uriToSlug(uris.file('no-directory.markdown'))).toEqual(
      'no-directory'
    );
    expect(uriToSlug(uris.file('many.dots.name.markdown'))).toEqual(
      'manydotsname'
    );
  });

  it('normalizes URI before hashing', () => {
    expect(uriToHash(uris.file('/this/is/a/path.md'))).toEqual(
      uriToHash(uris.file('/this/has/../is/a/path.md'))
    );
    expect(uriToHash(uris.file('this/is/a/path.md'))).toEqual(
      uriToHash(uris.file('this/has/../is/a/path.md'))
    );
  });

  it('computes a relative uri using a slug', () => {
    expect(computeRelativeURI(uris.file('/my/file.md'), '../hello.md')).toEqual(
      uris.file('/hello.md')
    );
    expect(computeRelativeURI(uris.file('/my/file.md'), '../hello')).toEqual(
      uris.file('/hello.md')
    );
    expect(
      computeRelativeURI(uris.file('/my/file.markdown'), '../hello')
    ).toEqual(uris.file('/hello.markdown'));
  });

  describe('URI parsing', () => {
    const base = uris.file('/path/to/file.md');
    test.each([
      ['https://www.google.com', uris.parse('https://www.google.com')],
      ['/path/to/a/file.md', uris.file('/path/to/a/file.md')],
      ['../relative/file.md', uris.file('/path/relative/file.md')],
      ['#section', uris.from(base, { fragment: 'section' })],
      [
        '../relative/file.md#section',
        uris.parse('file:/path/relative/file.md#section'),
      ],
    ])('URI Parsing (%s) - %s', (input, exp) => {
      const result = parseWithReference(input, base);
      expect(result.scheme).toEqual(exp.scheme);
      expect(result.authority).toEqual(exp.authority);
      expect(result.path).toEqual(exp.path);
      expect(result.query).toEqual(exp.query);
      expect(result.fragment).toEqual(exp.fragment);
    });
  });
});

describe('hashtag extraction', () => {
  it('works with simple strings', () => {
    expect(extractHashtags('hello #world on #this planet')).toEqual(
      new Set(['world', 'this'])
    );
  });
  it('works with tags at beginning or end of text', () => {
    expect(extractHashtags('#hello world on this #planet')).toEqual(
      new Set(['hello', 'planet'])
    );
  });
  it('supports _ and -', () => {
    expect(extractHashtags('#hello-world on #this_planet')).toEqual(
      new Set(['hello-world', 'this_planet'])
    );
  });
  it('ignores tags that only have numbers in text', () => {
    expect(
      extractHashtags('this #123 tag should be ignore, but not #123four')
    ).toEqual(new Set(['123four']));
  });
  it('supports unicode letters like Chinese charaters', () => {
    expect(
      extractHashtags(`
        this #tag_with_unicode_letters_汉字, pure Chinese tag like #纯中文标签 and 
        other mixed tags like #标签1 #123四 should work
      `)
    ).toEqual(
      new Set(['tag_with_unicode_letters_汉字', '纯中文标签', '标签1', '123四'])
    );
  });

  it('ignores hashes in plain text urls and links', () => {
    expect(
      extractHashtags(`
        test text with url https://site.com/#section1 https://site.com/home#section2 and
        https://site.com/home/#section3a
        [link](https://site.com/#section4) with [link2](https://site.com/home#section5) #control
        hello world
      `)
    ).toEqual(new Set(['control']));
  });

  it('ignores hashes in links to sections', () => {
    expect(
      extractHashtags(`
      this is a wikilink to [[#section1]] in the file and a [[link#section2]] in another
      this is a [link](#section3) to a section
      `)
    ).toEqual(new Set());
  });
});

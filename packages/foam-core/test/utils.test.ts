import {
  uriToSlug,
  nameToSlug,
  hashURI,
  computeRelativeURI,
  extractHashtags,
  parseUri,
} from '../src/utils';
import { URI } from '../src/common/uri';
import { Logger } from '../src/utils/log';

Logger.setLevel('error');

describe('URI utils', () => {
  it('supports various cases', () => {
    expect(uriToSlug(URI.file('/this/is/a/path.md'))).toEqual('path');
    expect(uriToSlug(URI.file('../a/relative/path.md'))).toEqual('path');
    expect(uriToSlug(URI.file('another/relative/path.md'))).toEqual('path');
    expect(uriToSlug(URI.file('no-directory.markdown'))).toEqual(
      'no-directory'
    );
    expect(uriToSlug(URI.file('many.dots.name.markdown'))).toEqual(
      'manydotsname'
    );
  });

  it('converts a name to a slug', () => {
    expect(nameToSlug('this.has.dots')).toEqual('thishasdots');
    expect(nameToSlug('title')).toEqual('title');
    expect(nameToSlug('this is a title')).toEqual('this-is-a-title');
    expect(nameToSlug('this is a title/slug')).toEqual('this-is-a-titleslug');
  });

  it('normalizes URI before hashing', () => {
    expect(hashURI(URI.file('/this/is/a/path.md'))).toEqual(
      hashURI(URI.file('/this/has/../is/a/path.md'))
    );
    expect(hashURI(URI.file('this/is/a/path.md'))).toEqual(
      hashURI(URI.file('this/has/../is/a/path.md'))
    );
  });

  it('computes a relative uri using a slug', () => {
    expect(computeRelativeURI(URI.file('/my/file.md'), '../hello.md')).toEqual(
      URI.file('/hello.md')
    );
    expect(computeRelativeURI(URI.file('/my/file.md'), '../hello')).toEqual(
      URI.file('/hello.md')
    );
    expect(
      computeRelativeURI(URI.file('/my/file.markdown'), '../hello')
    ).toEqual(URI.file('/hello.markdown'));
  });

  describe('URI parsing', () => {
    const base = URI.file('/path/to/file.md');
    test.each([
      ['https://www.google.com', URI.parse('https://www.google.com')],
      ['/path/to/a/file.md', URI.file('/path/to/a/file.md')],
      ['../relative/file.md', URI.file('/path/relative/file.md')],
      ['#section', base.with({ fragment: 'section' })],
      [
        '../relative/file.md#section',
        URI.parse('file:/path/relative/file.md#section'),
      ],
    ])('URI Parsing (%s) - %s', (input, exp) => {
      const result = parseUri(base, input);
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

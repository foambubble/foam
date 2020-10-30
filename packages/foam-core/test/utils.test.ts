import { uriToSlug, hashURI, computeRelativeURI, extractHashtags } from '../src/utils';

describe('URI utils', () => {
  it('supports various cases', () => {
    expect(uriToSlug('/this/is/a/path.md')).toEqual('path');
    expect(uriToSlug('../a/relative/path.md')).toEqual('path');
    expect(uriToSlug('another/relative/path.md')).toEqual('path');
    expect(uriToSlug('no-directory.markdown')).toEqual('no-directory');
    expect(uriToSlug('many.dots.name.markdown')).toEqual('manydotsname');
  });

  it('normalizes URI before hashing', () => {
    expect(hashURI('/this/is/a/path.md')).toEqual(
      hashURI('/this/has/../is/a/path.md')
    );
    expect(hashURI('this/is/a/path.md')).toEqual(
      hashURI('this/has/../is/a/path.md')
    );
  });

  it('computes a relative uri using a slug', () => {
    expect(computeRelativeURI('/my/file.md', '../hello.md')).toEqual(
      '/hello.md'
    );
    expect(computeRelativeURI('/my/file.md', '../hello')).toEqual('/hello.md');
    expect(computeRelativeURI('/my/file.markdown', '../hello')).toEqual(
      '/hello.markdown'
    );
  });
});

describe('hashtag extraction', () => {
  it('works with simple strings', () => {
    expect(extractHashtags('hello #world on #this planet'))
      .toEqual(new Set(['world', 'this']))
  });
  it('works with tags at beginning or end of text', () => {
    expect(extractHashtags('#hello world on this #planet'))
      .toEqual(new Set(['hello', 'planet']))
  });
  it('supports _ and -', () => {
    expect(extractHashtags('#hello-world on #this_planet'))
      .toEqual(new Set(['hello-world', 'this_planet']))
  });
})

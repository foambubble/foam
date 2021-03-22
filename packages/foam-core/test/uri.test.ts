import { URI } from '../src/model/uri';
import { uriToSlug } from '../src/utils/slug';

describe('Foam URIs', () => {
  describe('URI parsing', () => {
    const base = URI.file('/path/to/file.md');
    test.each([
      ['https://www.google.com', URI.parse('https://www.google.com')],
      ['/path/to/a/file.md', URI.file('/path/to/a/file.md')],
      ['../relative/file.md', URI.file('/path/relative/file.md')],
      ['#section', URI.create({ ...base, fragment: 'section' })],
      [
        '../relative/file.md#section',
        URI.parse('file:/path/relative/file.md#section'),
      ],
    ])('URI Parsing (%s) - %s', (input, exp) => {
      const result = URI.resolve(input, base);
      expect(result.scheme).toEqual(exp.scheme);
      expect(result.authority).toEqual(exp.authority);
      expect(result.path).toEqual(exp.path);
      expect(result.query).toEqual(exp.query);
      expect(result.fragment).toEqual(exp.fragment);
    });
  });
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

  it('computes a relative uri using a slug', () => {
    expect(
      URI.computeRelativeURI(URI.file('/my/file.md'), '../hello.md')
    ).toEqual(URI.file('/hello.md'));
    expect(URI.computeRelativeURI(URI.file('/my/file.md'), '../hello')).toEqual(
      URI.file('/hello.md')
    );
    expect(
      URI.computeRelativeURI(URI.file('/my/file.markdown'), '../hello')
    ).toEqual(URI.file('/hello.markdown'));
  });
});

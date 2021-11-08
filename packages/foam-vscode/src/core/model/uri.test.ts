import { Logger } from '../utils/log';
import { uriToSlug } from '../utils/slug';
import { URI } from './uri';

Logger.setLevel('error');

describe('Foam URI', () => {
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
    ])('URI Parsing (%s)', (input, exp) => {
      const result = URI.resolve(input, base);
      expect(result.scheme).toEqual(exp.scheme);
      expect(result.authority).toEqual(exp.authority);
      expect(result.path).toEqual(exp.path);
      expect(result.query).toEqual(exp.query);
      expect(result.fragment).toEqual(exp.fragment);
    });

    it('normalizes the Windows drive letter to upper case', () => {
      const upperCase = URI.parse('file:///C:/this/is/a/Path');
      const lowerCase = URI.parse('file:///c:/this/is/a/Path');
      expect(upperCase.path).toEqual('/C:/this/is/a/Path');
      expect(lowerCase.path).toEqual('/C:/this/is/a/Path');
      expect(URI.toFsPath(upperCase)).toEqual('C:\\this\\is\\a\\Path');
      expect(URI.toFsPath(lowerCase)).toEqual('C:\\this\\is\\a\\Path');
    });

    it('consistently parses file paths', () => {
      const win1 = URI.file('c:\\this\\is\\a\\path');
      const win2 = URI.parse('c:\\this\\is\\a\\path');
      expect(win1).toEqual(win2);

      const unix1 = URI.file('/this/is/a/path');
      const unix2 = URI.parse('/this/is/a/path');
      expect(unix1).toEqual(unix2);
    });

    it('correctly parses file paths', () => {
      const winUri = URI.file('c:\\this\\is\\a\\path');
      const unixUri = URI.file('/this/is/a/path');
      expect(winUri).toEqual(
        URI.create({
          scheme: 'file',
          path: '/C:/this/is/a/path',
        })
      );
      expect(unixUri).toEqual(
        URI.create({
          scheme: 'file',
          path: '/this/is/a/path',
        })
      );
    });
  });

  it('supports computing relative paths', () => {
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

  it('can be slugified', () => {
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
});

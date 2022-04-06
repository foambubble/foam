import { Logger } from '../utils/log';
import { URI } from './uri';

Logger.setLevel('error');

describe('Foam URI', () => {
  describe('URI parsing', () => {
    const base = URI.file('/path/to/file.md');
    test.each([
      ['https://www.google.com', URI.parse('https://www.google.com')],
      ['/path/to/a/file.md', URI.file('/path/to/a/file.md')],
      ['../relative/file.md', URI.file('/path/relative/file.md')],
      ['#section', base.withFragment('section')],
      [
        '../relative/file.md#section',
        URI.parse('file:/path/relative/file.md#section'),
      ],
    ])('URI Parsing (%s)', (input, exp) => {
      const result = base.resolve(input);
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
      expect(upperCase.toFsPath()).toEqual('C:\\this\\is\\a\\Path');
      expect(lowerCase.toFsPath()).toEqual('C:\\this\\is\\a\\Path');
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
        new URI({
          scheme: 'file',
          path: '/C:/this/is/a/path',
        })
      );
      expect(unixUri).toEqual(
        new URI({
          scheme: 'file',
          path: '/this/is/a/path',
        })
      );
    });
  });

  it('supports computing relative paths', () => {
    expect(URI.file('/my/file.md').resolve('../hello.md')).toEqual(
      URI.file('/hello.md')
    );
    expect(URI.file('/my/file.md').resolve('../hello')).toEqual(
      URI.file('/hello.md')
    );
    expect(URI.file('/my/file.markdown').resolve('../hello')).toEqual(
      URI.file('/hello.markdown')
    );
    expect(
      URI.file('/path/to/a/note.md').resolve('../another-note.md')
    ).toEqual(URI.file('/path/to/another-note.md'));
    expect(
      URI.file('/path/to/a/note.md').relativeTo(
        URI.file('/path/to/another/note.md').getDirectory()
      )
    ).toEqual(URI.file('../a/note.md'));
  });
});

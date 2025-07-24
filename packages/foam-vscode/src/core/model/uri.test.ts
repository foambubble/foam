import { Logger } from '../utils/log';
import { asAbsoluteUri, URI } from './uri';

Logger.setLevel('error');

describe('Foam URI', () => {
  describe('URI parsing', () => {
    const base = URI.file('/path/to/file.md');
    test.each([
      ['https://www.google.com', URI.parse('https://www.google.com')],
      ['/path/to/a/file.md', URI.parse('file:///path/to/a/file.md')],
      ['../relative/file.md', URI.parse('file:///path/relative/file.md')],
      ['#section', base.with({ fragment: 'section' })],
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

describe('asAbsoluteUri', () => {
  it('should throw if no workspace folder is found', () => {
    expect(() => asAbsoluteUri(URI.file('relative/path'), [])).toThrow();
  });
  it('should return the given URI if already absolute', () => {
    const uri = URI.file('/absolute/path');
    expect(asAbsoluteUri(uri, [URI.file('/base')])).toEqual(uri);
  });
  describe('with relative URI', () => {
    it('should return a URI relative if the given URI is relative and there is only one workspace folder', () => {
      const uri = URI.file('relative/path');
      const workspaceFolder = URI.file('/workspace/folder');
      expect(asAbsoluteUri(uri, [workspaceFolder])).toEqual(
        workspaceFolder.joinPath(uri.path)
      );
    });
    it('should match the first folder with the same name as the first part of the URI', () => {
      const uri = URI.file('folder2/file');
      const workspaceFolder1 = URI.file('/absolute/path/folder1');
      const workspaceFolder2 = URI.file('/absolute/path/folder2');
      expect(asAbsoluteUri(uri, [workspaceFolder1, workspaceFolder2])).toEqual(
        workspaceFolder2.joinPath('file')
      );
    });
  });
  it('should use the first folder if no matching folder is found', () => {
    const uri = URI.file('folder3/file');
    const workspaceFolder1 = URI.file('/absolute/path/folder1');
    const workspaceFolder2 = URI.file('/absolute/path/folder2');
    expect(asAbsoluteUri(uri, [workspaceFolder1, workspaceFolder2])).toEqual(
      workspaceFolder1.joinPath(uri.path)
    );
  });
  it('should use the first matching folder', () => {
    const uri = URI.file('folder/file');
    const workspaceFolder1 = URI.file('/absolute/path1');
    const workspaceFolder2 = URI.file('/absolute/path2/folder');
    const workspaceFolder3 = URI.file('/absolute/path3/folder');
    expect(
      asAbsoluteUri(uri, [workspaceFolder1, workspaceFolder2, workspaceFolder3])
    ).toEqual(workspaceFolder2.joinPath('file'));
  });

  describe('with Windows filesystem paths', () => {
    it('should return the given path if it is a Windows absolute path (C: drive)', () => {
      const windowsPath = 'C:/Users/user/template.md';
      const workspaceFolder = URI.file('/workspace/folder');
      const result = asAbsoluteUri(windowsPath, [workspaceFolder]);
      // Should convert to proper URI format
      expect(result.path).toEqual('C:/Users/user/template.md');
    });

    it('should return the given path if it is a Windows absolute path (backslashes)', () => {
      const windowsPath = 'C:\\Users\\user\\template.md';
      const workspaceFolder = URI.file('/workspace/folder');
      const result = asAbsoluteUri(windowsPath, [workspaceFolder]);
      // Should convert to proper URI format
      expect(result.path).toEqual('C:\\Users\\user\\template.md');
    });

    it('should treat relative Windows-style paths as relative', () => {
      const relativePath = 'folder\\subfolder\\file.md';
      const workspaceFolder = URI.file('/workspace/folder');
      const result = asAbsoluteUri(relativePath, [workspaceFolder]);
      expect(result.path).toEqual(
        '/workspace/folder/folder\\subfolder\\file.md'
      );
    });
  });
});

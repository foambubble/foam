import * as uris from '../src/model/uri';

describe('Foam URIs', () => {
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
      const result = uris.parseWithReference(input, base);
      expect(result.scheme).toEqual(exp.scheme);
      expect(result.authority).toEqual(exp.authority);
      expect(result.path).toEqual(exp.path);
      expect(result.query).toEqual(exp.query);
      expect(result.fragment).toEqual(exp.fragment);
    });
  });
  it('supports various cases', () => {
    expect(uris.uriToSlug(uris.file('/this/is/a/path.md'))).toEqual('path');
    expect(uris.uriToSlug(uris.file('../a/relative/path.md'))).toEqual('path');
    expect(uris.uriToSlug(uris.file('another/relative/path.md'))).toEqual(
      'path'
    );
    expect(uris.uriToSlug(uris.file('no-directory.markdown'))).toEqual(
      'no-directory'
    );
    expect(uris.uriToSlug(uris.file('many.dots.name.markdown'))).toEqual(
      'manydotsname'
    );
  });

  it('normalizes URI before hashing', () => {
    expect(uris.uriToHash(uris.file('/this/is/a/path.md'))).toEqual(
      uris.uriToHash(uris.file('/this/has/../is/a/path.md'))
    );
    expect(uris.uriToHash(uris.file('this/is/a/path.md'))).toEqual(
      uris.uriToHash(uris.file('this/has/../is/a/path.md'))
    );
  });

  it('computes a relative uri using a slug', () => {
    expect(
      uris.computeRelativeURI(uris.file('/my/file.md'), '../hello.md')
    ).toEqual(uris.file('/hello.md'));
    expect(
      uris.computeRelativeURI(uris.file('/my/file.md'), '../hello')
    ).toEqual(uris.file('/hello.md'));
    expect(
      uris.computeRelativeURI(uris.file('/my/file.markdown'), '../hello')
    ).toEqual(uris.file('/hello.markdown'));
  });

  it('ignores drive letter when parsing file paths on Windows', () => {
    // Clear module cache in jest
    jest.resetModules();

    // Mock the platform
    jest.doMock('../src/common/platform', () => {
      const original = jest.requireActual('../src/common/platform');
      return {
        ...original,
        isWindows: true,
      };
    });

    // Require the URI module with the platform, scoped for this test only
    const file = require('../src/model/uri').file;
    expect(file('c:\\test\\path')).toEqual(file('C:\\test\\path'));

    // Unmock the platform module
    jest.unmock('../src/common/platform');
  });
});

import { URI } from '@foam/core';
import { commonPathBase, slugForUri } from './slug';

describe('slugForUri', () => {
  it('produces a slug from the path without the extension when no base is provided', () => {
    expect(slugForUri(URI.file('/notes/alpha.md'))).toBe('notes-alpha');
  });

  it('flattens nested directories into the slug', () => {
    expect(slugForUri(URI.file('/notes/sub/dir/beta.md'))).toBe(
      'notes-sub-dir-beta'
    );
  });

  it('produces distinct slugs for files with the same basename in different folders', () => {
    const a = slugForUri(URI.file('/one/index.md'));
    const b = slugForUri(URI.file('/two/index.md'));
    expect(a).not.toBe(b);
  });

  it('handles URIs with no extension', () => {
    expect(slugForUri(URI.file('/notes/alpha'))).toBe('notes-alpha');
  });

  it('strips the base path so absolute filesystem paths are not baked into ids', () => {
    // Regression: before this, `/Users/jane/code/project/wiki/glossary.md`
    // slugged to `users-jane-code-project-wiki-glossary` — ugly and brittle.
    expect(
      slugForUri(
        URI.file('/Users/jane/code/project/wiki/glossary.md'),
        '/Users/jane/code/project'
      )
    ).toBe('wiki-glossary');
  });

  it('keeps the path absolute when it falls outside the provided base', () => {
    expect(
      slugForUri(URI.file('/other/place/alpha.md'), '/Users/jane/project')
    ).toBe('other-place-alpha');
  });

  it('falls back to the basename when the URI equals the base', () => {
    // Defensive case — a single-note report whose base resolves to the note
    // itself shouldn't produce an empty slug. The extension is still stripped
    // at the slug step so the result is just the file stem.
    expect(
      slugForUri(URI.file('/notes/alpha.md'), '/notes/alpha.md')
    ).toBe('alpha');
  });
});

describe('commonPathBase', () => {
  it('returns the longest directory shared by every URI', () => {
    expect(
      commonPathBase([
        URI.file('/Users/jane/code/project/wiki/intro.md'),
        URI.file('/Users/jane/code/project/wiki/glossary.md'),
        URI.file('/Users/jane/code/project/wiki/sub/beta.md'),
      ])
    ).toBe('/Users/jane/code/project/wiki');
  });

  it('returns the directory of the only URI for a single-note set', () => {
    expect(commonPathBase([URI.file('/notes/alpha.md')])).toBe('/notes');
  });

  it('returns an empty string when URIs share no common path', () => {
    expect(
      commonPathBase([URI.file('/alpha/one.md'), URI.file('/beta/two.md')])
    ).toBe('');
  });

  it('returns an empty string for an empty input list', () => {
    expect(commonPathBase([])).toBe('');
  });

  it('stops at the last `/` so a shared filename stem does not survive', () => {
    // `/wiki/foo` is shared as a string but only `/wiki` is a directory.
    expect(
      commonPathBase([URI.file('/wiki/foo-one.md'), URI.file('/wiki/foo-two.md')])
    ).toBe('/wiki');
  });
});

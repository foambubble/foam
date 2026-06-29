import { describe, expect, it } from 'vitest';
import { slugifyUrlPath, slugifyUrlSegment } from './slug';

describe('slugifyUrlSegment', () => {
  it('lowercases and replaces non-alphanumeric runs with a single dash', () => {
    expect(slugifyUrlSegment('Title of my New Note')).toBe(
      'title-of-my-new-note'
    );
  });

  it('collapses runs of non-alphanumeric characters into a single dash', () => {
    expect(slugifyUrlSegment('foo --- bar___baz!!!')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugifyUrlSegment('---hello---')).toBe('hello');
  });

  it('is idempotent on already-kebab-case input', () => {
    expect(slugifyUrlSegment('already-kebab')).toBe('already-kebab');
  });

  it('does not split on /, treating it as just another character', () => {
    expect(slugifyUrlSegment('a/b/c')).toBe('a-b-c');
  });
});

describe('slugifyUrlPath', () => {
  it('slugifies each segment and rejoins with /', () => {
    expect(slugifyUrlPath('Docs/Getting Started/Hello World')).toBe(
      'docs/getting-started/hello-world'
    );
  });

  it('returns the empty string for empty or slash-only input', () => {
    expect(slugifyUrlPath('')).toBe('');
    expect(slugifyUrlPath('/')).toBe('');
    expect(slugifyUrlPath('//')).toBe('');
  });

  it('drops empty segments produced by leading/trailing slashes', () => {
    expect(slugifyUrlPath('/Docs/Getting Started/')).toBe(
      'docs/getting-started'
    );
  });

  describe('with preserveExtension', () => {
    it('keeps the extension on the last segment (lowercased)', () => {
      expect(
        slugifyUrlPath('My Files/User Guide.PDF', { preserveExtension: true })
      ).toBe('my-files/user-guide.pdf');
    });

    it('lowercases and slugifies the stem but leaves the extension intact', () => {
      expect(
        slugifyUrlPath('foo bar.PNG', { preserveExtension: true })
      ).toBe('foo-bar.png');
    });

    it('is a no-op on already-kebab paths', () => {
      expect(
        slugifyUrlPath('assets/logo.png', { preserveExtension: true })
      ).toBe('assets/logo.png');
    });

    it('treats a filename with no dot as plain (no extension to preserve)', () => {
      expect(
        slugifyUrlPath('docs/README', { preserveExtension: true })
      ).toBe('docs/readme');
    });
  });
});

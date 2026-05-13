/* eslint-disable jest/no-conditional-expect */
import { posix as nodePosix } from 'node:path';
import {
  asAbsolutePaths,
  changeExtension,
  fromFsPath,
  getBasename,
  getDirectory,
  getExtension,
  getName,
  isAbsolute,
  isWithinPath,
  joinPath,
  relativeTo,
  toFsPath,
} from './path';
import { URI } from '../model/uri';

describe('path utils', () => {
  describe('fromFsPath', () => {
    it('should normalize backslashes in relative paths', () => {
      const [path] = fromFsPath('areas\\dailies\\2024\\file.md');
      expect(path).toBe('areas/dailies/2024/file.md');
    });

    it('should handle mixed separators in relative paths', () => {
      const [path] = fromFsPath('areas/dailies\\2024/file.md');
      expect(path).toBe('areas/dailies/2024/file.md');
    });

    it('should preserve forward slashes in relative paths', () => {
      const [path] = fromFsPath('areas/dailies/2024/file.md');
      expect(path).toBe('areas/dailies/2024/file.md');
    });

    it('should normalize backslashes in Windows absolute paths', () => {
      const [path] = fromFsPath('C:\\workspace\\file.md');
      expect(path).toBe('/C:/workspace/file.md');
    });
  });

  describe('asAbsolutePaths', () => {
    it('returns the path if already absolute', () => {
      const paths = asAbsolutePaths('/path/to/test', [
        '/root/Users',
        '/root/tmp',
      ]);
      expect(paths).toEqual(['/path/to/test']);
    });
    it('returns the matching base if found', () => {
      const paths = asAbsolutePaths('tmp/to/test', [
        '/root/Users',
        '/root/tmp',
      ]);
      expect(paths).toEqual(['/root/tmp/to/test']);
    });
    it('returns all bases if no match is found', () => {
      const paths = asAbsolutePaths('path/to/test', [
        '/root/Users',
        '/root/tmp',
      ]);
      expect(paths).toEqual([
        '/root/Users/path/to/test',
        '/root/tmp/path/to/test',
      ]);
    });
  });

  // The functions below were originally thin wrappers around Node's
  // `path.posix.*`; we now ship our own POSIX implementation so @foam/core
  // works in browsers (vite, RN). These tests assert parity with Node's
  // reference implementation across a representative input set.

  describe('parity with node:path/posix', () => {
    const SINGLE_ARG_INPUTS = [
      '',
      '.',
      '..',
      '/',
      'foo',
      '/foo',
      '/foo/',
      '/foo/bar',
      '/foo/bar/',
      '/foo/bar/baz.ext',
      '/foo/bar/baz.tar.gz',
      '/foo/.hidden',
      '/foo/.hidden.txt',
      'foo/bar',
      'foo/bar/baz',
      './foo',
      '../foo',
      '/a/b/../c',
      '/a/b/./c',
      '/a//b//c',
      '/d1/d2',
      '/d1/d2/f.ext',
    ];

    const RELATIVE_PAIRS: Array<[string, string]> = [
      ['/', '/'],
      ['/foo', '/foo'],
      ['/foo', '/bar'],
      ['/d1', '/d1/d2'],
      ['/d1/d2', '/d1'],
      ['/d1/d2', '/d1/d3'],
      ['/d1/d2', '/d1/d2/d3/d4'],
      ['/a/b/c', '/a/x/y'],
      ['/a', '/a/b/c'],
      ['/a/b/c', '/a'],
    ];

    const JOIN_INPUTS: string[][] = [
      ['/d1', 'd2', 'f.ext'],
      ['/d1/d2', '..', 'f.ext'],
      ['foo', 'bar'],
      ['/', 'foo'],
      ['', 'foo'],
      ['foo', '', 'bar'],
      ['/a/b', '../c'],
      ['a', 'b', 'c'],
    ];

    describe('isAbsolute', () => {
      it.each(SINGLE_ARG_INPUTS)('matches node for %p', (p) => {
        expect(isAbsolute(p)).toBe(nodePosix.isAbsolute(p));
      });
    });

    describe('getDirectory (posix.dirname)', () => {
      it.each(SINGLE_ARG_INPUTS)('matches node for %p', (p) => {
        expect(getDirectory(p)).toBe(nodePosix.dirname(p));
      });
    });

    describe('getBasename (posix.basename)', () => {
      it.each(SINGLE_ARG_INPUTS)('matches node for %p', (p) => {
        expect(getBasename(p)).toBe(nodePosix.basename(p));
      });
    });

    describe('getExtension (posix.extname)', () => {
      it.each(SINGLE_ARG_INPUTS)('matches node for %p', (p) => {
        expect(getExtension(p)).toBe(nodePosix.extname(p));
      });
    });

    describe('joinPath (posix.join)', () => {
      it.each(JOIN_INPUTS)('matches node for %p', (...parts) => {
        expect(joinPath(...parts)).toBe(nodePosix.join(...parts));
      });
    });

    describe('relativeTo (posix.relative)', () => {
      // Note: relativeTo(path, basePath) corresponds to posix.relative(basePath, path)
      it.each(RELATIVE_PAIRS)('matches node for from=%p to=%p', (from, to) => {
        expect(relativeTo(to, from)).toBe(nodePosix.relative(from, to));
      });
    });
  });

  describe('changeExtension', () => {
    it("strips the matching extension when 'to' is empty", () => {
      expect(changeExtension('/d/f.md', '.md', '')).toBe('/d/f');
    });
    it('changes the extension when from matches', () => {
      expect(changeExtension('/d/f.md', '.md', '.txt')).toBe('/d/f.txt');
    });
    it("treats '*' as a wildcard match", () => {
      expect(changeExtension('/d/f.md', '*', '.txt')).toBe('/d/f.txt');
    });
    it("returns input unchanged when 'from' doesn't match", () => {
      expect(changeExtension('/d/f.md', '.txt', '.html')).toBe('/d/f.md');
    });
  });

  describe('getName', () => {
    it('strips the extension', () => {
      expect(getName('/d/f.md')).toBe('f');
    });
    it('handles dotfiles correctly', () => {
      expect(getName('/d/.hidden')).toBe('.hidden');
    });
  });

  describe('isWithinPath', () => {
    const root = URI.file('/a/b');
    it('returns true for the same path', () => {
      expect(isWithinPath(URI.file('/a/b'), root)).toBe(true);
    });
    it('returns true for a nested path', () => {
      expect(isWithinPath(URI.file('/a/b/c/d.md'), root)).toBe(true);
    });
    it('returns false for a sibling path', () => {
      expect(isWithinPath(URI.file('/a/c'), root)).toBe(false);
    });
    it('returns false for a path that prefix-matches but is not nested', () => {
      expect(isWithinPath(URI.file('/a/bb'), root)).toBe(false);
    });
  });

  describe('toFsPath round-trip', () => {
    it('round-trips a Windows-style POSIX path', () => {
      const fs = 'C:\\workspace\\file.md';
      const [posixPath] = fromFsPath(fs);
      expect(toFsPath(posixPath)).toBe(fs);
    });
  });
});

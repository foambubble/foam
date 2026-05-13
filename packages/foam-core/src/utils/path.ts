import { URI } from '../model/uri';
import { CharCode } from '../common/charCode';
import { isNone } from './core';

/**
 * POSIX path operations re-implemented locally so `@foam/core` runs in both
 * Node and browser contexts (vite, RN, etc.). The functions below mirror
 * Node's `path.posix.*` semantics — see `path.test.ts` for a parity suite
 * comparing them against `node:path/posix`.
 */
const posix = {
  isAbsolute(p: string): boolean {
    return p.length > 0 && p.charCodeAt(0) === CharCode.Slash;
  },

  /** Equivalent to `path.posix.normalize`. */
  normalize(p: string): string {
    if (p.length === 0) return '.';
    const isAbs = posix.isAbsolute(p);
    const trailingSep = p.charCodeAt(p.length - 1) === CharCode.Slash;
    const segs = p.split('/');
    const out: string[] = [];
    for (const seg of segs) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') {
        if (out.length > 0 && out[out.length - 1] !== '..') {
          out.pop();
        } else if (!isAbs) {
          out.push('..');
        }
        continue;
      }
      out.push(seg);
    }
    let result = out.join('/');
    if (trailingSep && result !== '') result += '/';
    if (isAbs) return '/' + result;
    return result === '' ? '.' : result;
  },

  /** Equivalent to `path.posix.dirname`. */
  dirname(p: string): string {
    if (p.length === 0) return '.';
    const isAbs = p.charCodeAt(0) === CharCode.Slash;
    let end = -1;
    let matchedSlash = true;
    for (let i = p.length - 1; i >= 1; i--) {
      if (p.charCodeAt(i) === CharCode.Slash) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        matchedSlash = false;
      }
    }
    if (end === -1) return isAbs ? '/' : '.';
    if (isAbs && end === 0) return '/';
    return p.slice(0, end);
  },

  /** Equivalent to `path.posix.basename` (no `ext` arg — not used here). */
  basename(p: string): string {
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    for (let i = p.length - 1; i >= 0; i--) {
      if (p.charCodeAt(i) === CharCode.Slash) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
    }
    if (end === -1) return '';
    return p.slice(start, end);
  },

  /** Equivalent to `path.posix.extname`. */
  extname(p: string): string {
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for (let i = p.length - 1; i >= 0; i--) {
      const code = p.charCodeAt(i);
      if (code === CharCode.Slash) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === CharCode.Period) {
        if (startDot === -1) startDot = i;
        else if (preDotState !== 1) preDotState = 1;
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (
      startDot === -1 ||
      end === -1 ||
      preDotState === 0 ||
      (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    ) {
      return '';
    }
    return p.slice(startDot, end);
  },

  /** Equivalent to `path.posix.join`. Normalises the result. */
  join(...paths: string[]): string {
    if (paths.length === 0) return '.';
    let joined: string | undefined;
    for (const arg of paths) {
      if (arg.length > 0) {
        if (joined === undefined) joined = arg;
        else joined += '/' + arg;
      }
    }
    if (joined === undefined) return '.';
    return posix.normalize(joined);
  },

  /** Equivalent to `path.posix.relative`. Both inputs treated as absolute. */
  relative(from: string, to: string): string {
    if (from === to) return '';
    from = posix.resolve(from);
    to = posix.resolve(to);
    if (from === to) return '';

    const fromStart = 1; // skip leading '/'
    const fromEnd = from.length;
    const fromLen = fromEnd - fromStart;
    const toStart = 1;
    const toLen = to.length - toStart;
    const length = fromLen < toLen ? fromLen : toLen;

    let lastCommonSep = -1;
    let i = 0;
    for (; i < length; i++) {
      const fromCode = from.charCodeAt(fromStart + i);
      if (fromCode !== to.charCodeAt(toStart + i)) break;
      if (fromCode === CharCode.Slash) lastCommonSep = i;
    }
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === CharCode.Slash) {
          return to.slice(toStart + i + 1);
        }
        if (i === 0) return to.slice(toStart + i);
      }
      if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === CharCode.Slash) {
          lastCommonSep = i;
        } else if (i === 0) {
          lastCommonSep = 0;
        }
      }
    }

    let out = '';
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; i++) {
      if (i === fromEnd || from.charCodeAt(i) === CharCode.Slash) {
        out += out.length === 0 ? '..' : '/..';
      }
    }
    return out + to.slice(toStart + lastCommonSep);
  },

  /** Helper used by `relative`. POSIX-only, treats single-arg as the path
   *  relative to '/'. */
  resolve(p: string): string {
    if (posix.isAbsolute(p)) return posix.normalize(p);
    return posix.normalize('/' + p);
  },
};

/**
 * Converts filesystem path to POSIX path. Supported inputs are:
 *   - Windows path starting with a drive letter, e.g. C:\dir\file.ext
 *   - UNC path for a shared file, e.g. \\server\share\path\file.ext
 *   - POSIX path, e.g. /dir/file.ext
 *
 * @param path A supported filesystem path.
 * @returns [path, authority] where path is a POSIX representation for the
 *     given input and authority is undefined except for UNC paths.
 */
export function fromFsPath(path: string): [string, string] {
  let authority: string;
  if (isUNCShare(path)) {
    [path, authority] = parseUNCShare(path);
  } else if (hasDrive(path)) {
    path = '/' + path[0].toUpperCase() + path.substring(1);
  } else if (path[0] === '/' && hasDrive(path, 1)) {
    // POSIX representation of a Windows path: just normalize drive letter case
    path = '/' + path[1].toUpperCase() + path.substring(2);
  }

  // Always normalize backslashes to forward slashes (filesystem → POSIX)
  path = path.replace(/\\/g, '/');

  return [path, authority];
}

/**
 * Converts a POSIX path to a filesystem path.
 *
 * @param path A POSIX path.
 * @param authority An optional authority used to build UNC paths. This only
 *     makes sense for the Windows platform.
 * @returns A platform-specific representation of the given POSIX path.
 */
export function toFsPath(path: string, authority?: string): string {
  if (path[0] === '/' && hasDrive(path, 1)) {
    path = path.substring(1).replace(/\//g, '\\');
    if (authority) {
      path = `\\\\${authority}${path}`;
    }
  }
  return path;
}

/**
 * Extracts the containing directory of a POSIX path, e.g.
 *    - /d1/d2/f.ext -> /d1/d2
 *    - /d1/d2 -> /d1
 *
 * @param path A POSIX path.
 * @returns true if the path is absolute, false otherwise.
 */
export function isAbsolute(path: string): boolean {
  return posix.isAbsolute(path);
}

/**
 * Extracts the containing directory of a POSIX path, e.g.
 *    - /d1/d2/f.ext -> /d1/d2
 *    - /d1/d2 -> /d1
 *
 * @param path A POSIX path.
 * @returns The containing directory of the given path.
 */
export function getDirectory(path: string): string {
  return posix.dirname(path);
}

/**
 * Extracts the basename of a POSIX path, e.g. /d/f.ext -> f.ext.
 *
 * @param path A POSIX path.
 * @returns The basename of the given path.
 */
export function getBasename(path: string): string {
  return posix.basename(path);
}

/**
 * Extracts the name of a POSIX path, e.g. /d/f.ext -> f.
 *
 * @param path A POSIX path.
 * @returns The name of the given path.
 */
export function getName(path: string): string {
  return changeExtension(getBasename(path), '*', '');
}

/**
 * Extracts the extension of a POSIX path, e.g.
 *    - /d/f.ext -> .ext
 *    - /d/f.g.ext -> .ext
 *    - /d/f -> ''
 *
 * @param path A POSIX path.
 * @returns The extension of the given path.
 */
export function getExtension(path: string): string {
  return posix.extname(path);
}

/**
 * Changes a POSIX path matching some extension to have another extension.
 *
 * @param path A POSIX path.
 * @param from The required current extension, or '*' to match any extension.
 * @param to The target extension.
 * @returns A POSIX path with its extension possibly changed.
 */
export function changeExtension(
  path: string,
  from: string,
  to: string
): string {
  const old = getExtension(path);
  if ((from === '*' && old !== to) || old === from) {
    path = path.substring(0, path.length - old.length);
    return to ? path + to : path;
  }
  return path;
}

/**
 * Joins a number of POSIX paths into a single POSIX path, e.g.
 *    - /d1, d2, f.ext -> /d1/d2/f.ext
 *    - /d1/d2, .., f.ext -> /d1/f.ext
 *
 * @param paths A variable number of POSIX paths.
 * @returns A POSIX path built from the given POSIX paths.
 */
export function joinPath(...paths: string[]): string {
  return posix.join(...paths);
}

/**
 * Makes a POSIX path relative to another POSIX path, e.g.
 *    - /d1/d2 relative to /d1 -> d2
 *    - /d1/d2 relative to /d1/d3 -> ../d2
 *
 * @param path The POSIX path to be made relative.
 * @param basePath The POSIX base path.
 * @returns A POSIX path relative to the base path.
 */
export function relativeTo(path: string, basePath: string): string {
  return posix.relative(basePath, path);
}

/**
 * Returns true when `path` is equal to or nested under `parent`.
 */
export function isWithinPath(path: URI, parent: URI): boolean {
  return path.path === parent.path || path.path.startsWith(parent.path + '/');
}

function hasDrive(path: string, idx = 0): boolean {
  if (path.length <= idx) {
    return false;
  }
  const c = path.charCodeAt(idx);
  return (
    ((c >= CharCode.A && c <= CharCode.Z) ||
      (c >= CharCode.a && c <= CharCode.z)) &&
    path.charCodeAt(idx + 1) === CharCode.Colon
  );
}

function isUNCShare(fsPath: string): boolean {
  return (
    fsPath.length >= 2 &&
    fsPath.charCodeAt(0) === CharCode.Backslash &&
    fsPath.charCodeAt(1) === CharCode.Backslash
  );
}

function parseUNCShare(uncPath: string): [string, string] {
  const idx = uncPath.indexOf('\\', 2);
  if (idx === -1) {
    return [uncPath.substring(2), '\\'];
  } else {
    return [uncPath.substring(2, idx), uncPath.substring(idx) || '\\'];
  }
}

/**
 * Turns a relative path into an absolute path given a collection of base folders.
 * - if no base folder is provided, it will throw
 * - if the given path is already absolute, it will return it
 * - if the given path is relative it will return absolute paths for the ones matching the
 *     first part of the path
 * - if no matching base folder is found, it will return an absolute path per base folder
 * @param path the path to evaluate
 * @param baseFolders the base folders to use
 * @returns an array of absolute path, guaranteed to have at least 1 element
 */
export function asAbsolutePaths(path: string, baseFolders: string[]): string[] {
  if (isNone(baseFolders) || baseFolders.length === 0) {
    throw new Error('Cannot compute absolute URI without a base');
  }

  if (isAbsolute(path)) {
    return [path];
  }
  let tokens = path.split('/');
  const firstDir = tokens[0];
  const res = [];
  if (baseFolders.length > 1) {
    for (const folder of baseFolders) {
      const lastDir = folder.split('/').pop();
      if (lastDir === firstDir) {
        tokens = tokens.slice(1);
        res.push([folder, ...tokens].join('/'));
        continue;
      }
    }
  }
  if (res.length === 0) {
    for (const folder of baseFolders) {
      const match = folder.endsWith('/')
        ? folder.substring(0, folder.length - 1)
        : folder;
      res.push([match, ...tokens].join('/'));
    }
  }
  return res;
}

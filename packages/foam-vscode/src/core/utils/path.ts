import { CharCode } from '../common/charCode';
import { posix } from 'path';

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
    path = path.replace(/\\/g, '/');
  } else if (hasDrive(path)) {
    path = '/' + path[0].toUpperCase() + path.substr(1).replace(/\\/g, '/');
  } else if (path[0] === '/' && hasDrive(path, 1)) {
    // POSIX representation of a Windows path: just normalize drive letter case
    path = '/' + path[1].toUpperCase() + path.substr(2);
  }
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
    path = path.substr(1).replace(/\//g, '\\');
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

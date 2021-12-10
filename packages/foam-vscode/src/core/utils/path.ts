import { CharCode } from '../common/charCode';
import { posix } from 'path';
import { promises, constants } from 'fs';

export function isAbsolute(uriPath: string): boolean {
  return uriPath.startsWith('/');
}

export function relativeTo(uriPath: string, baseUriPath: string): string {
  return posix.relative(posix.dirname(baseUriPath), uriPath);
}

export function getExtension(uriPath: string): string {
  return posix.extname(uriPath);
}

export function removeExtension(uriPath: string): string {
  let ext = getExtension(uriPath);
  return uriPath.substring(0, uriPath.length - ext.length);
}

export function getBasename(uriPath: string): string {
  return posix.basename(uriPath);
}

export function getName(uriPath: string): string {
  return removeExtension(getBasename(uriPath));
}

export function getDirectory(uriPath: string): string {
  return posix.dirname(uriPath);
}

export function joinPath(baseUriPath: string, ...uriPaths: string[]): string {
  return posix.join(baseUriPath, ...uriPaths);
}

export async function existsInFs(fsPath: string) {
  try {
    await promises.access(fsPath, constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

export function isUNCShare(fsPath: string): boolean {
  return fsPath.length >= 2 && fsPath[0] === '\\' && fsPath[1] === '\\';
}

export function parseUNCShare(uncPath: string): [string, string] {
  const idx = uncPath.indexOf('\\', 2);
  if (idx === -1) {
    return [uncPath.substring(2), '\\'];
  } else {
    return [uncPath.substring(2, idx), uncPath.substring(idx) || '\\'];
  }
}

export function toUriPath(path: string): string {
  if (hasDrive(path, 0)) {
    return '/' + path[0].toUpperCase() + path.substr(1).replace(/\\/g, '/');
  }
  if (path[0] === '/' && hasDrive(path, 1)) {
    return '/' + path[1].toUpperCase() + path.substr(2);
  }
  return path;
}

export function toFsPath(uriPath: string): string {
  if (uriPath[0] === '/' && hasDrive(uriPath, 1)) {
    return uriPath[1].toUpperCase() + uriPath.substr(2).replace(/\//g, '\\');
  }
  return uriPath;
}

export function isIdentifier(path: string): boolean {
  return !(
    path.startsWith('/') ||
    path.startsWith('./') ||
    path.startsWith('../')
  );
}

/**
 * Returns the minimal identifier for the given string amongst others
 *
 * @param uriPath the value to compute the identifier for
 * @param amongstUriPaths the set of strings within which to find the identifier
 */
export function getShortestIdentifier(
  uriPath: string,
  amongstUriPaths: string[]
): string {
  const needleTokens = uriPath.split('/').reverse();
  const haystack = amongstUriPaths
    .filter(value => value !== uriPath)
    .map(value => value.split('/').reverse());

  let tokenIndex = 0;
  let res = needleTokens;
  while (tokenIndex < needleTokens.length) {
    for (let j = haystack.length - 1; j >= 0; j--) {
      if (
        haystack[j].length < tokenIndex ||
        needleTokens[tokenIndex] !== haystack[j][tokenIndex]
      ) {
        haystack.splice(j, 1);
      }
    }
    if (haystack.length === 0) {
      res = needleTokens.splice(0, tokenIndex + 1);
      break;
    }
    tokenIndex++;
  }
  const identifier = res
    .filter(token => token.trim() !== '')
    .reverse()
    .join('/');

  return identifier;
}

function hasDrive(path: string, idx: number): boolean {
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

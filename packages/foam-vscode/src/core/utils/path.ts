import { posix } from 'path';
import { promises, constants } from 'fs';

export function isIdentifier(uriPath: string): boolean {
  return !(
    uriPath.startsWith('/') ||
    uriPath.startsWith('./') ||
    uriPath.startsWith('../')
  );
}

export function isAbsolute(uriPath: string): boolean {
  return uriPath.startsWith('/');
}

export function relativeTo(baseUriPath: string, uriPath: string): string {
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

export function getDir(uriPath: string): string {
  return posix.dirname(uriPath);
}

export function joinPaths(baseUriPath: string, ...uriPaths: string[]): string {
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

function hasDrive(path: string, idx: number): boolean {
  return (
    path.length > idx && path[idx].match(/[a-zA-Z]/) && path[idx + 1] === ':'
  );
}

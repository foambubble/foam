import { CharCode } from '../common/charCode';
import { posix } from 'path';
import { promises, constants } from 'fs';

export function asPath(value: string): string {
  if (value[0] === '/' && hasDrive(value, 1)) {
    return '/' + value[1].toUpperCase() + value.substr(2);
  }
  if (hasDrive(value, 0)) {
    return '/' + value[0].toUpperCase() + value.substr(1).replace(/\\/g, '/');
  }
  return value;
}

export function toFsPath(path: string): string {
  if (path[0] === '/' && hasDrive(path, 1)) {
    return path[1].toUpperCase() + path.substr(2).replace(/\//g, '\\');
  }
  return path;
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

export function getExtension(path: string): string {
  return posix.extname(path);
}

export function removeExtension(path: string): string {
  let ext = getExtension(path);
  return path.substring(0, path.length - ext.length);
}

export function getBasename(path: string): string {
  return posix.basename(path);
}

export function getName(path: string): string {
  return removeExtension(getBasename(path));
}

export function getDirectory(path: string): string {
  return posix.dirname(path);
}

export function joinPath(basePath: string, ...paths: string[]): string {
  return posix.join(basePath, ...paths);
}

export function relativeTo(path: string, basePath: string): string {
  return posix.relative(basePath, path);
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

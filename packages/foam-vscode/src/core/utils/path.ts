import { CharCode } from '../common/charCode';
import { posix } from 'path';
import { promises, constants } from 'fs';

export function asPath(value: string): [string, string] {
  let authority: string;
  if (isUNCShare(value)) {
    [value, authority] = parseUNCShare(value);
  }
  if (value[0] === '/' && hasDrive(value, 1)) {
    value = '/' + value[1].toUpperCase() + value.substr(2);
  }
  if (hasDrive(value, 0)) {
    value = '/' + value[0].toUpperCase() + value.substr(1).replace(/\\/g, '/');
  }
  return [value, authority];
}

export function toFsPath(path: string, authority?: string): string {
  if (path[0] === '/' && hasDrive(path, 1)) {
    path = path.substr(1).replace(/\//g, '\\');
  }
  if (authority) {
    path = `\\\\${authority}${path}`;
  }
  return path;
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

export function getDirectory(path: string): string {
  return posix.dirname(path);
}

export function getBasename(path: string): string {
  return posix.basename(path);
}

export function getName(path: string): string {
  return changeExtension(getBasename(path), '*', '');
}

export function getExtension(path: string): string {
  return posix.extname(path);
}

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

function isUNCShare(fsPath: string): boolean {
  return fsPath.length >= 2 && fsPath[0] === '\\' && fsPath[1] === '\\';
}

function parseUNCShare(uncPath: string): [string, string] {
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

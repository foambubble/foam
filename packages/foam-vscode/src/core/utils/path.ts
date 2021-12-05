import { win32, posix } from 'path';
import { promises, constants } from 'fs';

export function isPath(value: string): boolean {
  return isRelative(value) || isAbsolute(value);
}

export function isRelative(path: string): boolean {
  return path.startsWith('./') || path.startsWith('../');
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

export function relativeTo(from: string, to: string): string {
  return posix.relative(posix.dirname(from), to);
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

export function getDir(path: string): string {
  return posix.dirname(path);
}

export function isUNCShare(path: string): boolean {
  return path[0] === '\\' && path[1] === '\\';
}

export function parseUNCShare(path: string): [string, string] {
  const idx = path.indexOf('\\', 2);
  if (idx === -1) {
    return [path.substring(2), '\\'];
  } else {
    return [path.substring(2, idx), path.substring(idx) || '\\'];
  }
}

export function isWindows(path: string): boolean {
  return (
    (path.length >= 2 && path[1] === ':') ||
    (path.length >= 3 && path[0] === '/' && path[2] === ':')
  );
}

export function join(basePath: string, ...paths: string[]): string {
  if (isWindows(basePath)) {
    return win32.join(toFsPath(basePath), ...paths);
  } else {
    return posix.join(basePath, ...paths);
  }
}

export function toUriPath(path: string): string {
  if (!isWindows(path)) {
    return path;
  }
  path = path.replace(/\\/g, '/');
  if (path[0] === '/') {
    return '/' + path[1].toUpperCase() + path.substr(2);
  } else {
    return '/' + path[0].toUpperCase() + path.substr(1);
  }
}

export function toFsPath(path: string): string {
  if (!isWindows(path)) {
    return path;
  }
  path = path.replace(/\//g, '\\');
  return path[1].toUpperCase() + path.substr(2);
}

export function exists(path: string) {
  return promises
    .access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

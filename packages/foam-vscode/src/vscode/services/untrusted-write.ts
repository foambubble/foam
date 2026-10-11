import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FoamError, URI, isWithinPath } from '@foam/core';

/**
 * Throws an `invalid_input` FoamError unless `uri` lies inside one of `roots`
 * once symlinks are resolved. A `..` after a symlink must stay inside both
 * ways a file system may read it: from the symlink's target, as the OS does,
 * and from the path as written, as a lexical normalization does. A dangling
 * symlink on the way counts as outside, since writing through it would create
 * its target wherever it points. Only local files have symlinks to follow;
 * any other `uri` passes.
 */
export async function assertInsideWorkspace(
  uri: URI,
  roots: URI[]
): Promise<void> {
  if (uri.scheme !== 'file') {
    return;
  }
  const realRoots = await Promise.all(
    roots.map(root => fs.realpath(root.toFsPath()).catch(() => undefined))
  );
  const fsPath = uri.toFsPath();
  for (const reading of new Set([fsPath, path.resolve(fsPath)])) {
    const realPath = await realPathOf(reading);
    const isInside =
      realPath !== undefined &&
      realRoots.some(
        root => root !== undefined && isWithinPath(realPath, URI.file(root))
      );
    if (!isInside) {
      throw new FoamError(
        'invalid_input',
        `Cannot write outside the workspace: ${fsPath}`,
        { uri: fsPath }
      );
    }
  }
}

/**
 * Where `fsPath` lands when resolved one part at a time, as the OS does: a
 * symlink followed where it is met, a `..` taken from the real folder reached
 * so far, and a part that doesn't exist yet kept as a folder created there.
 * Undefined through a dangling symlink.
 */
async function realPathOf(fsPath: string): Promise<URI | undefined> {
  const { root } = path.parse(fsPath);
  let real = root;
  for (const part of fsPath.slice(root.length).split(path.sep)) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      real = path.dirname(real);
      continue;
    }
    const next = path.join(real, part);
    if (!(await isPresent(next))) {
      real = next;
      continue;
    }
    const resolved = await fs.realpath(next).catch(() => undefined);
    if (resolved === undefined) {
      return undefined;
    }
    real = resolved;
  }
  return URI.file(real);
}

const isPresent = (fsPath: string) =>
  fs.lstat(fsPath).then(
    () => true,
    () => false
  );

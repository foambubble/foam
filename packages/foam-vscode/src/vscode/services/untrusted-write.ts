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
 * `fsPath` with symlinks resolved, the parts that don't exist yet appended to
 * the real path of the nearest part that does; undefined through a dangling
 * symlink.
 */
async function realPathOf(fsPath: string): Promise<URI | undefined> {
  let existing = fsPath;
  const missing: string[] = [];
  while (!(await isPresent(existing))) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return fs.realpath(existing).then(
    real => URI.file(path.join(real, ...missing)),
    () => undefined
  );
}

const isPresent = (fsPath: string) =>
  fs.lstat(fsPath).then(
    () => true,
    () => false
  );

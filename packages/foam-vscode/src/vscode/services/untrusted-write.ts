import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FoamError, URI, isWithinPath } from '@foam/core';

/**
 * Where a new note at `uri` is written in an untrusted workspace: `uri` with
 * `..` segments resolved, when it lies inside one of `roots` once symlinks are
 * resolved as well. Throws an `invalid_input` FoamError otherwise. A dangling
 * symlink on the way counts as outside, since writing through it would create
 * its target wherever it points. Only local files have symlinks to follow;
 * any other `uri` is returned as it is.
 *
 * Write to the returned URI, not to `uri`: the OS would resolve a `..` after a
 * symlink from the symlink's target.
 */
export async function untrustedWriteTarget(
  uri: URI,
  roots: URI[]
): Promise<URI> {
  if (uri.scheme !== 'file') {
    return uri;
  }
  const resolved = path.resolve(uri.toFsPath());
  let existing = resolved;
  const missing: string[] = [];
  while (!(await isPresent(existing))) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const realPath = await fs.realpath(existing).then(
    real => URI.file(path.join(real, ...missing)),
    () => undefined
  );
  for (const root of roots) {
    const realRoot = await fs.realpath(root.toFsPath()).catch(() => undefined);
    if (
      realPath !== undefined &&
      realRoot !== undefined &&
      isWithinPath(realPath, URI.file(realRoot))
    ) {
      return URI.file(resolved);
    }
  }
  throw new FoamError(
    'invalid_input',
    `Cannot write outside the workspace: ${resolved}`,
    { uri: resolved }
  );
}

const isPresent = (fsPath: string) =>
  fs.lstat(fsPath).then(
    () => true,
    () => false
  );

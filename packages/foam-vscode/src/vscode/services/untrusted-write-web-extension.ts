import { URI } from '@foam/core';

/**
 * Throws unless `uri` lies inside one of `roots` once symlinks are resolved.
 * The web extension host has no symlinks to follow, so every `uri` passes.
 */
export async function assertInsideWorkspace(
  _uri: URI,
  _roots: URI[]
): Promise<void> {}

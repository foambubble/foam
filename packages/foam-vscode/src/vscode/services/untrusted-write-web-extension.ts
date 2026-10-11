import { URI } from '@foam/core';

/**
 * Where a new note at `uri` is written in an untrusted workspace. The web
 * extension host has no symlinks to follow, so `uri` is returned as it is.
 */
export async function untrustedWriteTarget(
  uri: URI,
  _roots: URI[]
): Promise<URI> {
  return uri;
}

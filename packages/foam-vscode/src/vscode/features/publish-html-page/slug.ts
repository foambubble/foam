import { URI, toSlug } from '@foam/core';

/**
 * Produces a stable, CSS-id-safe slug for a note URI.
 *
 * When a `basePath` is provided the slug is computed from the path **relative
 * to** that base, so a note at `/Users/jane/code/project/wiki/glossary.md`
 * with `basePath` `/Users/jane/code/project/` slugs to `wiki-glossary` rather
 * than dragging the absolute filesystem path through every id.
 *
 * Without a base the absolute path is used (slug is still unique, just
 * uglier). This is what the CLI / tests get when there's no obvious base to
 * pick.
 */
export function slugForUri(uri: URI, basePath?: string): string {
  const path = stripBase(uri.path, basePath);
  const stripped = path.replace(/\.[^./]+$/, '').replace(/^\//, '');
  return toSlug(stripped.replace(/\//g, '-'));
}

function stripBase(path: string, base: string | undefined): string {
  if (!base) return path;
  const baseWithSlash = base.endsWith('/') ? base : base + '/';
  if (path.startsWith(baseWithSlash)) return path.slice(baseWithSlash.length);
  // Exact equality (rare — base IS the note's path): fall back to basename.
  if (path === base) {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? path : path.slice(lastSlash + 1);
  }
  return path;
}

/**
 * Returns the longest path prefix that every URI in `uris` shares, stopping
 * at the last `/` so the result is always a directory boundary. Empty string
 * when there's no common prefix or when called with an empty list.
 *
 * Used by the report renderer to derive a "report root" from the included
 * notes themselves — that way slugs are short and self-contained, without
 * needing the workspace root passed in. Single-note reports get the note's
 * own directory as the base so the slug becomes just the basename.
 */
export function commonPathBase(uris: URI[]): string {
  if (uris.length === 0) return '';
  if (uris.length === 1) {
    const path = uris[0].path;
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '' : path.slice(0, lastSlash);
  }
  const paths = uris.map(u => u.path);
  let prefix = paths[0];
  for (let i = 1; i < paths.length; i++) {
    while (!paths[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  // Stop at the last `/` so the prefix is a directory, not half a filename.
  const lastSlash = prefix.lastIndexOf('/');
  return lastSlash === -1 ? '' : prefix.slice(0, lastSlash);
}

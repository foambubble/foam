import { AttachmentResourceProvider } from '@foam/core';

/**
 * Builds a recursive glob that matches only files with the given extensions.
 *
 * @param extensions extensions to watch, with or without a leading dot
 *        (e.g. `['.md', 'pdf']`).
 * @returns a glob such as `**\/*.{md,pdf}`, or `**\/*.md` for a single
 *        extension. Falls back to `**\/*` when no extensions are given.
 */
export function buildWatchGlob(extensions: string[]): string {
  const normalized = Array.from(
    new Set(
      extensions.map(e => e.replace(/^\./, '').trim()).filter(e => e.length > 0)
    )
  );

  if (normalized.length === 0) {
    return '**/*';
  }
  if (normalized.length === 1) {
    return `**/*.${normalized[0]}`;
  }
  return `**/*.{${normalized.join(',')}}`;
}

/**
 * Builds the glob for the workspace file watcher.
 *
 * The attachment extensions come from the provider rather than from
 * `foam.files.attachmentExtensions`, because the provider also treats images
 * as attachments regardless of that setting. Reading the setting directly left
 * images unwatched, so a pasted image only showed up after a window reload
 * (issue #1697).
 */
export function buildWorkspaceWatchGlob(
  notesExtensions: string[],
  attachmentProvider: AttachmentResourceProvider
): string {
  return buildWatchGlob([
    ...notesExtensions,
    ...attachmentProvider.attachmentExtensions,
  ]);
}

/**
 * URL-segment slugification rules for static-site export targets.
 *
 * These rules are deliberately stricter than `toSlug` (which preserves
 * Unicode word characters and is used for heading IDs and document slugs):
 * they collapse every run of non-alphanumeric ASCII into a single dash,
 * lowercase, and trim leading/trailing dashes. The result is safe to use
 * verbatim as a URL path segment for Astro, Netlify, GitHub Pages, Vercel,
 * and basically every web target — which all normalise URLs this way.
 *
 * Keep these in `@foam/core/export/` rather than `utils/`: they encode an
 * export-specific convention (web targets), not a general slugification.
 */

/**
 * Slugifies a single string into a URL-safe path segment.
 *
 *   `'Title of my New Note'` → `'title-of-my-new-note'`
 *   `'foo --- bar___baz!!!'` → `'foo-bar-baz'`
 *
 * Does not treat `/` specially — for multi-segment paths use
 * {@link slugifyUrlPath}.
 */
export const slugifyUrlSegment = (segment: string): string =>
  segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export interface SlugifyUrlPathOptions {
  /**
   * Preserves the file extension on the last segment (lowercased, otherwise
   * untouched). For paths that name a file:
   *
   *   `'My Files/User Guide.PDF'` → `'my-files/user-guide.pdf'`
   *
   * Without this option, the dot would be collapsed into a dash:
   *
   *   `'My Files/User Guide.PDF'` → `'my-files/user-guide-pdf'`
   */
  preserveExtension?: boolean;
}

/**
 * Slugifies each `/`-separated segment of a path, then rejoins them.
 *
 *   `'Docs/Getting Started/Hello World'`
 *     → `'docs/getting-started/hello-world'`
 *
 * Pass `preserveExtension: true` when the last segment is a filename whose
 * extension must survive (see {@link SlugifyUrlPathOptions}).
 */
export const slugifyUrlPath = (
  path: string,
  options: SlugifyUrlPathOptions = {}
): string => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '';

  if (!options.preserveExtension) {
    return segments.map(slugifyUrlSegment).filter(Boolean).join('/');
  }

  const filename = segments[segments.length - 1];
  const lastDot = filename.lastIndexOf('.');
  const stem = lastDot >= 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot >= 0 ? filename.slice(lastDot) : '';
  const slugDirs = segments.slice(0, -1).map(slugifyUrlSegment);
  const slugFilename = slugifyUrlSegment(stem) + ext.toLowerCase();
  return [...slugDirs, slugFilename].filter(Boolean).join('/');
};

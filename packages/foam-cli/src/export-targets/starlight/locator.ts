import {
  changeExtension,
  ExportContext,
  getContentRelativePath,
  PublishLocation,
  PublishLocator,
  slugifyUrlPath,
  URI,
} from '@foam/core';

const DIRECTORY_INDEX_NAMES = new Set(['index', 'readme']);

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

/**
 * Maps a note URI to its Starlight route. Notes named `index` / `readme`
 * collapse to their parent directory (so `docs/index.md` → `/docs`, root
 * `index.md` → `/`).
 */
export const computeStarlightRoute = (
  uri: URI,
  context: ExportContext
): string => {
  const relativePath = getContentRelativePath(
    uri,
    context.workspace,
    context.contentRoot
  );
  const withoutExtension = changeExtension(
    relativePath,
    uri.getExtension(),
    ''
  );
  const segments = trimSlashes(withoutExtension)
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) {
    return '/';
  }

  const basename = segments[segments.length - 1].toLowerCase();
  if (DIRECTORY_INDEX_NAMES.has(basename)) {
    const parentPath = slugifyUrlPath(segments.slice(0, -1).join('/'));
    return parentPath.length === 0 ? '/' : `/${parentPath}`;
  }

  return `/${slugifyUrlPath(segments.join('/'))}`;
};

/**
 * Starlight locator. Notes get slugified routes; sections are normal
 * heading ids (Astro scopes them per-page already).
 */
export const starlightLocator: PublishLocator = {
  locate(uri: URI, context: ExportContext): PublishLocation | null {
    const resource = context.workspace.find(uri);
    if (!resource || resource.type !== 'note') {
      return null;
    }
    const href = computeStarlightRoute(uri, context);
    return {
      href,
      sectionAnchor: (slug: string) => `${href}#${slug}`,
      sectionId: (slug: string) => slug,
    };
  },
};

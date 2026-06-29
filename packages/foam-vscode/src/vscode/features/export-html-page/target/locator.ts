import {
  ExportContext,
  PublishLocation,
  PublishLocator,
  URI,
} from '@foam/core';
import { slugForUri } from '../slug';

export interface HtmlPageLocatorOptions {
  /**
   * Deepest directory shared by every included note. The locator uses it
   * to compute short, self-contained slugs (so `/a/b/c.md` becomes `c`,
   * not the absolute path). Computed once by the caller from the selected
   * notes — see `HtmlPageTarget`'s constructor.
   */
  slugBase: string;
}

/**
 * Locator factory for the HTML-page target.
 *
 * Section anchors and section ids are scoped together via `note-<slug>--`:
 * `sectionAnchor('intro')` and `sectionId('intro')` both produce
 * `note-foo--intro` so links and headings agree by construction.
 *
 * The "is this note in the export" check reads from `context.notes` —
 * the pipeline's canonical post-selection list — rather than a Set built
 * separately at construction time. Same source as `selectByUris`; no
 * second source of truth to keep in sync.
 *
 * Map keys throughout the pipeline use `URI.path`; the locator follows
 * suit so the lookup against `context.locations` upstream and the
 * `included` check here speak the same language.
 */
export const createHtmlPageLocator = (
  options: HtmlPageLocatorOptions
): PublishLocator => {
  const slugFor = (uri: URI) => slugForUri(uri, options.slugBase);

  return {
    locate(uri: URI, context: ExportContext): PublishLocation | null {
      const isInSet = context.notes.some(n => n.uri.path === uri.path);
      if (!isInSet) return null;

      const slug = slugFor(uri);
      const noteAnchor = `note-${slug}`;
      return {
        href: `#${noteAnchor}`,
        sectionAnchor: (sectionSlug: string) =>
          `#${noteAnchor}--${sectionSlug}`,
        sectionId: (sectionSlug: string) => `${noteAnchor}--${sectionSlug}`,
      };
    },
  };
};

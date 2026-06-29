import {
  AssetResolution,
  AssetStrategy,
  ExportContext,
  Resource,
} from '@foam/core';

/**
 * The HTML-page target produces a single self-contained file. Every
 * supported asset is inlined as a `data:` URI at emit time; unsupported
 * types are dropped from the link.
 *
 * The actual byte-loading + data-URI computation happens inside
 * `HtmlPageTarget.emit` — this strategy just signals intent. (See the
 * `inline` variant doc on `AssetResolution`.)
 */
export const htmlPageAssetStrategy: AssetStrategy = {
  resolve(_asset: Resource, _context: ExportContext): AssetResolution {
    return { kind: 'inline' };
  },
};

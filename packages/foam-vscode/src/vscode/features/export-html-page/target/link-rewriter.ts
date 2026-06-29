import {
  ExportContext,
  LinkRewriteResult,
  Resource,
  ResolvedLink,
  SourceLinkRewriter,
} from '@foam/core';

/**
 * Today the HTML-page target rewrites links at markdown-it render time via
 * the `markdown-link-anchors.ts` plugin (and `createHtmlPageLinkResolver`
 * for wikilinks). That logic stays in place for this PR — the source-level
 * `SourceLinkRewriter` interface is a no-op, kept here to satisfy the
 * `PublishTarget` contract.
 *
 * Moving the rewriting from markdown-it tokens to markdown source is a
 * follow-up PR. See the "Why source-level rewriting wins" section in the
 * task doc.
 */
export const htmlPageLinkRewriter: SourceLinkRewriter = {
  rewrite(
    _resolved: ResolvedLink,
    _note: Resource,
    _context: ExportContext
  ): LinkRewriteResult {
    return { kind: 'leave' };
  },
};

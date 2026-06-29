import {
  ExportContext,
  LinkRewriteResult,
  MarkdownLink,
  Resource,
  ResolvedLink,
  SourceLinkRewriter,
} from '@foam/core';

/**
 * Starlight emits markdown — links become `[label](target#section)`. Both
 * intra-site note links and asset links use the same shape (just different
 * target paths). Excluded notes and unresolved links are left in place; the
 * pipeline still surfaces a diagnostic for those.
 */
export const starlightLinkRewriter: SourceLinkRewriter = {
  rewrite(
    resolved: ResolvedLink,
    note: Resource,
    _context: ExportContext
  ): LinkRewriteResult {
    const { original: link } = resolved;
    const analyzed = MarkdownLink.analyzeLink(link);

    if (resolved.resolution.kind === 'unresolved') {
      return { kind: 'leave' };
    }
    if (resolved.resolution.kind === 'excluded') {
      return { kind: 'leave' };
    }
    if (resolved.resolution.kind === 'in-set') {
      const { targetResource, location } = resolved.resolution;
      // Self-link: keep `target` empty so the result is a pure section
      // anchor (`[label](#section)`) when there's a section, otherwise a
      // bare alias-only update.
      const target = targetResource.uri.isEqual(note.uri) ? '' : location.href;
      return {
        kind: 'edit',
        edit: MarkdownLink.createUpdateLinkEdit(link, {
          type: 'link',
          target,
          section: resolved.section,
          alias: analyzed.alias || targetResource.title,
        }),
      };
    }
    // in-set asset
    const { targetResource, assetResolution } = resolved.resolution;
    if (assetResolution.kind !== 'file') {
      // Starlight only does file mode; defensive.
      return { kind: 'leave' };
    }
    return {
      kind: 'edit',
      edit: MarkdownLink.createUpdateLinkEdit(link, {
        type: 'link',
        target: `/${assetResolution.outputPath}`,
        section: resolved.section,
        alias:
          analyzed.alias ||
          targetResource.title ||
          targetResource.uri.getBasename(),
      }),
    };
  },
};

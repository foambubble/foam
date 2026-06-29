import { Resource, ResourceLink } from '../../model/note';
import type { ResolvedLink } from '../target';
import { ExportContext } from '../types';

/**
 * Pre-resolves a link against the artifact set. The result tells the
 * target's `SourceLinkRewriter` exactly what shape this link takes in the
 * output address space, so the rewriter only has to decide how to *emit*
 * (not where things live).
 *
 * Returns `null` for external links — those are passed through verbatim,
 * no target involvement.
 */
export const resolveExportLink = (
  link: ResourceLink,
  note: Resource,
  context: ExportContext
): ResolvedLink | null => {
  if (link.type === 'external') {
    return null;
  }

  const resolvedUri = context.workspace.resolveLink(note, link);
  const section = resolvedUri.fragment || undefined;

  if (resolvedUri.isPlaceholder()) {
    return {
      original: link,
      section,
      resolution: { kind: 'unresolved', targetPath: resolvedUri.path },
    };
  }

  const targetResource = context.workspace.find(resolvedUri.asPlain());

  if (!targetResource) {
    return {
      original: link,
      section,
      resolution: { kind: 'unresolved', targetPath: resolvedUri.path },
    };
  }

  if (targetResource.type === 'note') {
    const location = context.locations.get(targetResource.uri.path);
    if (!location) {
      return {
        original: link,
        section,
        resolution: { kind: 'excluded', targetResource },
      };
    }
    return {
      original: link,
      section,
      resolution: { kind: 'in-set', targetResource, location },
    };
  }

  // Non-note resource (asset).
  const assetResolution = context.assetResolutions.get(targetResource.uri.path);
  if (!assetResolution || assetResolution.kind === 'skip') {
    return {
      original: link,
      section,
      resolution: { kind: 'excluded', targetResource },
    };
  }
  return {
    original: link,
    section,
    resolution: {
      kind: 'in-set-asset',
      targetResource,
      assetResolution,
    },
  };
};

import { Resource } from '../../model/note';
import { MarkdownLink } from '../../services/markdown-link';
import type { ResolvedLink } from '../target';
import { ExportedDiagnostic } from '../types';

/**
 * Pipeline-level warning emission. Targets decide *how* to render an
 * unresolved/excluded link in their output; the pipeline decides whether
 * that decision is also worth surfacing to the user as a diagnostic.
 */
export const collectLinkDiagnostics = (
  resolved: ResolvedLink,
  note: Resource,
  sourceRoute: string
): ExportedDiagnostic | null => {
  const link = resolved.original;
  const analyzed = MarkdownLink.analyzeLink(link);

  if (resolved.resolution.kind === 'unresolved') {
    return {
      level: 'warning',
      code: 'unresolved-link',
      sourceUri: note.uri,
      sourceRoute,
      link: link.rawText,
      target: analyzed.target || resolved.resolution.targetPath,
      message: `Could not resolve export target for ${link.rawText}.`,
    };
  }

  if (resolved.resolution.kind === 'excluded') {
    const targetResource = resolved.resolution.targetResource;
    if (targetResource.type !== 'note') {
      // Asset that didn't make the cut: silently drop. The link itself
      // becomes "leave as-is" and that's enough.
      return null;
    }
    return {
      level: 'warning',
      code: 'unresolved-link',
      sourceUri: note.uri,
      sourceRoute,
      link: link.rawText,
      target: targetResource.uri.path,
      message: `Resolved ${link.rawText} but the target note is outside the exported content scope.`,
    };
  }

  return null;
};

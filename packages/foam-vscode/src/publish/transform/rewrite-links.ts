import { Resource, ResourceLink } from '../../core/model/note';
import { TextEdit } from '../../core/services/text-edit';
import { MarkdownLink } from '../../core/services/markdown-link';
import { PublishContext, PublishedDiagnostic } from '../types';

const getLinkText = (
  link: ResourceLink,
  note: Resource,
  context: PublishContext
):
  | { target: string; alias: string; section?: string }
  | { diagnostic: PublishedDiagnostic }
  | null => {
  if (link.type === 'external') {
    return null;
  }

  const resolvedUri = context.workspace.resolveLink(note, link);
  const analyzed = MarkdownLink.analyzeLink(link);
  const sourceRoute = context.noteRoutes.get(note.uri.path);

  if (resolvedUri.isPlaceholder()) {
    return {
      diagnostic: {
        level: 'warning',
        code: 'unresolved-link',
        sourceUri: note.uri,
        sourceRoute,
        link: link.rawText,
        target: analyzed.target || resolvedUri.path,
        message: `Could not resolve publish target for ${link.rawText}.`,
      },
    };
  }

  const targetResource = context.workspace.find(resolvedUri.asPlain());
  const section = resolvedUri.fragment || undefined;

  if (targetResource?.type === 'note') {
    const route = context.noteRoutes.get(targetResource.uri.path);
    if (!route) {
      return {
        diagnostic: {
          level: 'warning',
          code: 'unresolved-link',
          sourceUri: note.uri,
          sourceRoute,
          link: link.rawText,
          target: targetResource.uri.path,
          message: `Resolved ${link.rawText} but the target note is outside the published content scope.`,
        },
      };
    }

    const targetRoute = targetResource.uri.isEqual(note.uri) ? '' : route;
    return {
      target: targetRoute,
      alias: analyzed.alias || targetResource.title,
      section,
    };
  }

  if (targetResource) {
    const outputPath = context.assetPaths.get(targetResource.uri.path);
    if (!outputPath) {
      return null;
    }

    return {
      target: outputPath,
      alias: analyzed.alias || targetResource.title || targetResource.uri.getBasename(),
      section,
    };
  }

  return {
    diagnostic: {
      level: 'warning',
      code: 'unresolved-link',
      sourceUri: note.uri,
      sourceRoute,
      link: link.rawText,
      target: analyzed.target || resolvedUri.path,
      message: `Resolved ${link.rawText} but the target is not publishable.`,
    },
  };
};

export const rewriteLinks = (
  markdown: string,
  note: Resource,
  context: PublishContext
) => {
  const diagnostics: PublishedDiagnostic[] = [];
  const edits = note.links
    .map(link => {
      const rewritten = getLinkText(link, note, context);
      if (!rewritten) {
        return null;
      }

      if ('diagnostic' in rewritten) {
        diagnostics.push(rewritten.diagnostic);
        return null;
      }

      return MarkdownLink.createUpdateLinkEdit(link, {
        type: 'link',
        target: rewritten.target,
        section: rewritten.section,
        alias: rewritten.alias,
      });
    })
    .filter((edit): edit is TextEdit => edit !== null);

  return {
    markdown: edits.length === 0 ? markdown : TextEdit.apply(markdown, edits),
    diagnostics,
  };
};

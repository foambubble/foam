import { Resource, ResourceLink } from '@foam/core';
import { TextEdit } from '@foam/core';
import { MarkdownLink } from '@foam/core';
import { ExportContext, ExportedDiagnostic } from '../types';

const getLinkText = (
  link: ResourceLink,
  note: Resource,
  context: ExportContext
):
  | { target: string; alias: string; section?: string }
  | { diagnostic: ExportedDiagnostic }
  | null => {
  if (link.type === 'external') {
    return null;
  }

  const resolvedUri = context.workspace.resolveLink(note, link);
  const analyzed = MarkdownLink.analyzeLink(link);
  const sourceRoute = context.noteRoutes.get(note.uri.path);

  if (!sourceRoute) {
    throw new Error(`Missing exported source route for ${note.uri.path}`);
  }

  if (resolvedUri.isPlaceholder()) {
    return {
      diagnostic: {
        level: 'warning',
        code: 'unresolved-link',
        sourceUri: note.uri,
        sourceRoute,
        link: link.rawText,
        target: analyzed.target || resolvedUri.path,
        message: `Could not resolve export target for ${link.rawText}.`,
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
          message: `Resolved ${link.rawText} but the target note is outside the exported content scope.`,
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
      message: `Resolved ${link.rawText} but the target is not exportable.`,
    },
  };
};

export const rewriteLinks = (
  markdown: string,
  note: Resource,
  context: ExportContext
) => {
  const diagnostics: ExportedDiagnostic[] = [];
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

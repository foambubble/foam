import { Resource, ResourceLink } from '../../core/model/note';
import { TextEdit } from '../../core/services/text-edit';
import { MarkdownLink } from '../../core/services/markdown-link';
import { PublishContext } from '../types';

const getLinkText = (
  link: ResourceLink,
  note: Resource,
  context: PublishContext
): { target: string; alias: string; section?: string } | null => {
  if (link.type === 'external') {
    return null;
  }

  const resolvedUri = context.workspace.resolveLink(note, link);
  if (resolvedUri.isPlaceholder()) {
    return null;
  }

  const targetResource = context.workspace.find(resolvedUri.asPlain());
  const analyzed = MarkdownLink.analyzeLink(link);
  const section = resolvedUri.fragment || undefined;

  if (targetResource?.type === 'note') {
    const route = context.noteRoutes.get(targetResource.uri.path);
    if (!route) {
      return null;
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

  return null;
};

export const rewriteLinks = (
  markdown: string,
  note: Resource,
  context: PublishContext
) => {
  const edits = note.links
    .map(link => {
      const rewritten = getLinkText(link, note, context);
      if (!rewritten) {
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

  return edits.length === 0 ? markdown : TextEdit.apply(markdown, edits);
};

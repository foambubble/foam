import { Resource } from '../../core/model/note';
import { buildBacklinks } from '../derive/build-backlink-index';
import { PublishContext, PublishedNote } from '../types';
import { rewriteLinks } from './rewrite-links';

export const transformNote = async (
  note: Resource,
  context: PublishContext
): Promise<PublishedNote> => {
  const markdown = (await context.workspace.readAsMarkdown(note.uri)) ?? '';
  const route = context.noteRoutes.get(note.uri.path);

  if (!route) {
    throw new Error(`Missing published route for ${note.uri.path}`);
  }

  return {
    sourceUri: note.uri,
    route,
    title: note.title,
    markdown: rewriteLinks(markdown, note, context),
    backlinks: buildBacklinks(note, context),
  };
};

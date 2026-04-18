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
  const properties =
    note.properties && typeof note.properties === 'object'
      ? { ...note.properties }
      : {};
  const description =
    typeof properties.description === 'string' ? properties.description : undefined;

  if (!route) {
    throw new Error(`Missing published route for ${note.uri.path}`);
  }

  return {
    sourceUri: note.uri,
    route,
    title: note.title,
    description,
    properties,
    markdown: rewriteLinks(markdown, note, context),
    backlinks: buildBacklinks(note, context),
  };
};

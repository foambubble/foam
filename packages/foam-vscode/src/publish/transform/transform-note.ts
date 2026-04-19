import { Resource } from '../../core/model/note';
import { buildBacklinks } from '../derive/build-backlink-index';
import { PublishContext, PublishedDiagnostic, PublishedNote } from '../types';
import { rewriteLinks } from './rewrite-links';

interface TransformedNote {
  note: PublishedNote;
  diagnostics: PublishedDiagnostic[];
}

export const transformNote = async (
  note: Resource,
  context: PublishContext
): Promise<TransformedNote> => {
  const markdown = (await context.workspace.readAsMarkdown(note.uri)) ?? '';
  const route = context.noteRoutes.get(note.uri.path);
  const properties =
    note.properties && typeof note.properties === 'object'
      ? { ...note.properties }
      : {};
  const description =
    typeof properties.description === 'string' ? properties.description : undefined;
  const rewritten = rewriteLinks(markdown, note, context);

  if (!route) {
    throw new Error(`Missing published route for ${note.uri.path}`);
  }

  return {
    note: {
      sourceUri: note.uri,
      route,
      title: note.title,
      description,
      properties,
      markdown: rewritten.markdown,
      backlinks: buildBacklinks(note, context),
    },
    diagnostics: rewritten.diagnostics,
  };
};

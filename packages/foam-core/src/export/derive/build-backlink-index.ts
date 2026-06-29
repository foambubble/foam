import { Connection } from '../../model/graph';
import { Resource } from '../../model/note';
import { ExportContext, ExportedBacklink } from '../types';

const toExportedBacklink = (
  connection: Connection,
  context: ExportContext
): ExportedBacklink | null => {
  const source = context.workspace.find(connection.source);
  if (!source || source.type !== 'note' || !context.include(source)) {
    return null;
  }

  const location = context.locations.get(source.uri.path);
  if (!location) {
    return null;
  }

  return {
    route: location.href,
    title: source.title,
    sourceUri: source.uri,
  };
};

export const buildBacklinks = (
  note: Resource,
  context: ExportContext
): ExportedBacklink[] => {
  const bySource = new Map<string, ExportedBacklink>();
  for (const connection of context.graph.getBacklinks(note.uri)) {
    const backlink = toExportedBacklink(connection, context);
    if (backlink && !bySource.has(backlink.sourceUri.path)) {
      bySource.set(backlink.sourceUri.path, backlink);
    }
  }
  return Array.from(bySource.values()).sort((left, right) =>
    left.route.localeCompare(right.route)
  );
};

import { Connection } from '@foam/core';
import { Resource } from '@foam/core';
import { ExportContext, ExportedBacklink } from '../types';

const toExportedBacklink = (
  connection: Connection,
  context: ExportContext
): ExportedBacklink | null => {
  const source = context.workspace.find(connection.source);
  if (!source || source.type !== 'note' || !context.include(source)) {
    return null;
  }

  const route = context.noteRoutes.get(source.uri.path);
  if (!route) {
    return null;
  }

  return {
    route,
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

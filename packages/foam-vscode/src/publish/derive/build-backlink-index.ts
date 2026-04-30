import { Connection } from '@foam/core';
import { Resource } from '@foam/core';
import { PublishContext, PublishedBacklink } from '../types';

const toPublishedBacklink = (
  connection: Connection,
  context: PublishContext
): PublishedBacklink | null => {
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
  context: PublishContext
): PublishedBacklink[] =>
  context.graph
    .getBacklinks(note.uri)
    .map(connection => toPublishedBacklink(connection, context))
    .filter((backlink): backlink is PublishedBacklink => backlink !== null)
    .sort((left, right) => left.route.localeCompare(right.route));

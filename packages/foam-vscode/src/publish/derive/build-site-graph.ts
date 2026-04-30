import { Resource } from '@foam/core';
import { buildGraphData } from '../../services/graph-data-builder';
import {
  PublishContext,
  PublishedGraphData,
  PublishedRoute,
} from '../types';

export const buildPublishedGraph = (
  context: PublishContext,
  notes: Resource[],
  routes: PublishedRoute[]
): PublishedGraphData => {
  const routeBySourcePath = new Map(
    routes.map(route => [route.sourceUri.path, route.route])
  );
  return buildGraphData(notes, context.graph.getAllConnections(), {
    resourceToId: uri => routeBySourcePath.get(uri.path),
  });
};

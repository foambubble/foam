import { Resource } from '@foam/core';
import { buildGraphData } from '@foam/core';
import {
  ExportContext,
  ExportedGraphData,
  ExportedRoute,
} from '../types';

export const buildExportedGraph = (
  context: ExportContext,
  notes: Resource[],
  routes: ExportedRoute[]
): ExportedGraphData => {
  const routeBySourcePath = new Map(
    routes.map(route => [route.sourceUri.path, route.route])
  );
  return buildGraphData(notes, context.graph.getAllConnections(), {
    resourceToId: uri => routeBySourcePath.get(uri.path),
  });
};

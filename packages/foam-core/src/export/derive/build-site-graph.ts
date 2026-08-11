import { Resource } from '../../model/note';
import { buildGraphData } from '../../services/graph-data-builder';
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
    // The graph JSON ships with the published site: only allowlisted
    // presentation keys may leave the workspace, never raw frontmatter
    transformProperties: properties => {
      const safe: { color?: string; [key: string]: unknown } = {};
      if (typeof properties.color === 'string') {
        safe.color = properties.color;
      }
      if (properties.type !== undefined) {
        safe.type = properties.type;
      }
      return safe;
    },
  });
};

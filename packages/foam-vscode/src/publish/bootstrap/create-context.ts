import { FoamGraph } from '../../core/model/graph';
import { Resource } from '../../core/model/note';
import { getIncludeMatcher } from '../config';
import { buildAssetManifest, buildRouteManifest } from '../derive/build-route-manifest';
import { PublishConfig, PublishContext } from '../types';

export const createPublishContext = (config: PublishConfig): PublishContext => {
  const include = getIncludeMatcher(config);
  const graph = config.graph ?? FoamGraph.fromWorkspace(config.workspace);
  const resources = config.workspace.list().filter((resource: Resource) => {
    if (resource.type !== 'note') {
      return true;
    }

    return include(resource);
  });

  const routes = buildRouteManifest(resources, config.workspace);
  const assets = buildAssetManifest(resources, config.workspace);

  return {
    workspace: config.workspace,
    graph,
    include,
    noteRoutes: new Map(routes.map(route => [route.sourceUri.path, route.route])),
    assetPaths: new Map(
      assets.map(asset => [asset.sourceUri.path, `/${asset.outputPath}`])
    ),
  };
};

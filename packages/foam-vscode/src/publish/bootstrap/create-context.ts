import { FoamGraph } from '../../core/model/graph';
import { Resource } from '../../core/model/note';
import { getIncludeMatcher } from '../config';
import { buildAssetManifest, buildRouteManifest } from '../derive/build-route-manifest';
import { PublishConfig, PublishContext } from '../types';

export const createPublishContext = (config: PublishConfig): PublishContext => {
  const graph = config.graph ?? FoamGraph.fromWorkspace(config.workspace);
  const includeMatcher = getIncludeMatcher(config);
  const runtimeContext = {
    workspace: config.workspace,
    graph,
  };
  const include = (resource: Resource) => includeMatcher(resource, runtimeContext);
  const resources = config.workspace.list().filter((resource: Resource) => {
    if (resource.type !== 'note') {
      return true;
    }

    return include(resource);
  });

  const routes = buildRouteManifest(resources, config.workspace);
  const assets = buildAssetManifest(resources, config.workspace);

  return {
    ...runtimeContext,
    site: config.site,
    include,
    noteRoutes: new Map(routes.map(route => [route.sourceUri.path, route.route])),
    assetPaths: new Map(
      assets.map(asset => [asset.sourceUri.path, `/${asset.outputPath}`])
    ),
  };
};

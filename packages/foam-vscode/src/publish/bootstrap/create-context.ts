import { FoamGraph } from '../../core/model/graph';
import { Resource } from '../../core/model/note';
import { URI } from '../../core/model/uri';
import { getIncludeMatcher } from '../config';
import {
  buildAssetManifest,
  buildRouteManifest,
  isWithinPath,
} from '../derive/build-route-manifest';
import { PublishConfig, PublishContext } from '../types';

const resolveContentRoot = (config: PublishConfig): URI | null => {
  if (!config.contentRoot) {
    return null;
  }

  if (config.contentRoot instanceof URI) {
    return config.contentRoot.asPlain();
  }

  return config.workspace.resolveUri(config.contentRoot).asPlain();
};

export const createPublishContext = (config: PublishConfig): PublishContext => {
  const graph = config.graph ?? FoamGraph.fromWorkspace(config.workspace);
  const includeMatcher = getIncludeMatcher(config);
  const contentRoot = resolveContentRoot(config);
  const runtimeContext = {
    workspace: config.workspace,
    graph,
    contentRoot,
  };
  const include = (resource: Resource) => {
    if (contentRoot && !isWithinPath(resource.uri.asPlain(), contentRoot)) {
      return false;
    }

    return includeMatcher(resource, runtimeContext);
  };
  const resources = config.workspace.list().filter((resource: Resource) => {
    if (resource.type !== 'note') {
      return true;
    }

    return include(resource);
  });

  const routes = buildRouteManifest(resources, config.workspace, contentRoot);
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

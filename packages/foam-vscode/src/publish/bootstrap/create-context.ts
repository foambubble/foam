import { FoamGraph } from '../../core/model/graph';
import { Resource, ResourceLink } from '../../core/model/note';
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

const isPublishableAssetLink = (link: ResourceLink) =>
  link.type === 'wikilink' || link.type === 'link';

const collectLinkedAssets = (
  notes: Resource[],
  workspace: PublishConfig['workspace'],
  includeAsset: (resource: Resource) => boolean
): Resource[] => {
  const assets = new Map<string, Resource>();

  notes.forEach(note => {
    note.links.forEach(link => {
      if (!isPublishableAssetLink(link)) {
        return;
      }

      const resolvedUri = workspace.resolveLink(note, link).asPlain();
      if (resolvedUri.isPlaceholder()) {
        return;
      }

      const resource = workspace.find(resolvedUri);
      if (
        !resource ||
        resource.type === 'note' ||
        !includeAsset(resource)
      ) {
        return;
      }

      assets.set(resource.uri.path, resource);
    });
  });

  return Array.from(assets.values());
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
  const includeAsset = (resource: Resource) =>
    config.include ? includeMatcher(resource, runtimeContext) : true;
  const notes = config.workspace
    .list()
    .filter(
      (resource: Resource) => resource.type === 'note' && include(resource)
    );
  const linkedAssets = collectLinkedAssets(notes, config.workspace, includeAsset);
  const resources = [...notes, ...linkedAssets];

  const routes = buildRouteManifest(resources, config.workspace, contentRoot);
  const assetManifest = buildAssetManifest(resources, config.workspace);

  return {
    ...runtimeContext,
    site: config.site,
    include,
    includeAsset,
    resources,
    notes,
    assets: linkedAssets,
    noteRoutes: new Map(routes.map(route => [route.sourceUri.path, route.route])),
    assetPaths: new Map(
      assetManifest.map(asset => [asset.sourceUri.path, `/${asset.outputPath}`])
    ),
  };
};

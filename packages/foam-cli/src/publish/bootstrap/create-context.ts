import { FoamGraph } from '@foam/core';
import { Resource, ResourceLink } from '@foam/core';
import { URI } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { isWithinPath } from '@foam/core';
import { getIncludeAssetMatcher, getIncludeMatcher } from '../config';
import {
  buildAssetManifest,
  buildRouteManifest,
} from '../derive/build-route-manifest';
import { PublishAssetMatcher, PublishConfig, PublishContext } from '../types';

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
  graph: FoamGraph,
  workspace: FoamWorkspace,
  contentRoot: URI | null,
  includeAsset: PublishAssetMatcher
): Resource[] => {
  // Assets enter the publish graph only if a published note links to them.
  const assets = new Map<string, Resource>();
  const linkedFromByAsset = new Map<string, Resource[]>();

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
      if (!resource || resource.type === 'note') {
        return;
      }

      const linkedFrom = linkedFromByAsset.get(resource.uri.path) ?? [];
      if (!linkedFrom.some(candidate => candidate.uri.isEqual(note.uri))) {
        linkedFrom.push(note);
        linkedFromByAsset.set(resource.uri.path, linkedFrom);
      }

      if (
        !includeAsset(resource, {
          workspace,
          graph,
          contentRoot,
          publishedNotes: notes,
          linkedFrom,
        })
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
  const includeAssetMatcher = getIncludeAssetMatcher(config);
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
  const notes = config.workspace
    .list()
    .filter(
      (resource: Resource) => resource.type === 'note' && include(resource)
    );
  const linkedAssets = collectLinkedAssets(
    notes,
    graph,
    config.workspace,
    contentRoot,
    includeAssetMatcher
  );
  const resources = [...notes, ...linkedAssets];

  const publishedRoutes = buildRouteManifest(
    resources,
    config.workspace,
    contentRoot
  );
  const publishedAssets = buildAssetManifest(resources, config.workspace);

  return {
    ...runtimeContext,
    site: config.site,
    include,
    resources,
    notes,
    assets: linkedAssets,
    publishedRoutes,
    publishedAssets,
    noteRoutes: new Map(
      publishedRoutes.map(route => [route.sourceUri.path, route.route])
    ),
    assetPaths: new Map(
      publishedAssets.map(asset => [asset.sourceUri.path, `/${asset.outputPath}`])
    ),
  };
};

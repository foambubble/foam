import { changeExtension } from '../../core/utils/path';
import { Resource } from '../../core/model/note';
import { URI } from '../../core/model/uri';
import { FoamWorkspace } from '../../core/model/workspace';
import { PublishedAsset, PublishedRoute } from '../types';

const DIRECTORY_INDEX_NAMES = new Set(['index', 'readme']);

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const getRelativePath = (uri: URI, workspace: FoamWorkspace) => {
  const matchingRoot =
    workspace.roots.find(
      root => uri.path === root.path || uri.path.startsWith(root.path + '/')
    ) ?? null;

  if (matchingRoot) {
    return uri.relativeTo(matchingRoot).path;
  }

  return trimSlashes(uri.path);
};

export const getNoteRoute = (resource: Resource, workspace: FoamWorkspace) => {
  const relativePath = getRelativePath(resource.uri, workspace);
  const withoutExtension = changeExtension(
    relativePath,
    resource.uri.getExtension(),
    ''
  );
  const segments = trimSlashes(withoutExtension)
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) {
    return '/';
  }

  const basename = segments[segments.length - 1].toLowerCase();
  if (DIRECTORY_INDEX_NAMES.has(basename)) {
    const parentPath = segments.slice(0, -1).join('/');
    return parentPath.length === 0 ? '/' : `/${parentPath}`;
  }

  return `/${segments.join('/')}`;
};

export const getAssetOutputPath = (
  resource: Resource,
  workspace: FoamWorkspace
) => {
  const relativePath = trimSlashes(getRelativePath(resource.uri, workspace));
  return `assets/${relativePath}`;
};

export const buildRouteManifest = (
  resources: Resource[],
  workspace: FoamWorkspace
): PublishedRoute[] =>
  resources
    .filter(resource => resource.type === 'note')
    .map(resource => ({
      sourceUri: resource.uri,
      route: getNoteRoute(resource, workspace),
    }))
    .sort(
      (left, right) =>
        left.sourceUri.path.localeCompare(right.sourceUri.path) ||
        left.route.localeCompare(right.route)
    );

export const buildAssetManifest = (
  resources: Resource[],
  workspace: FoamWorkspace
): PublishedAsset[] =>
  resources
    .filter(resource => resource.type !== 'note')
    .map(resource => ({
      sourceUri: resource.uri,
      outputPath: getAssetOutputPath(resource, workspace),
    }))
    .sort(
      (left, right) =>
        left.sourceUri.path.localeCompare(right.sourceUri.path) ||
        left.outputPath.localeCompare(right.outputPath)
    );

import { changeExtension, isWithinPath } from '@foam/core';
import { Resource } from '@foam/core';
import { URI } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { ExportedAsset, ExportedRoute } from '../types';

const DIRECTORY_INDEX_NAMES = new Set(['index', 'readme']);

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const getWorkspaceRoot = (uri: URI, workspace: FoamWorkspace) => {
  const matchingRoot =
    workspace.roots.find(
      root => uri.path === root.path || uri.path.startsWith(root.path + '/')
    ) ?? null;

  return matchingRoot;
};

export const getWorkspaceRelativePath = (uri: URI, workspace: FoamWorkspace) => {
  const matchingRoot = getWorkspaceRoot(uri, workspace);

  if (matchingRoot) {
    return trimSlashes(uri.relativeTo(matchingRoot).path);
  }

  return trimSlashes(uri.path);
};

export const getContentRelativePath = (
  uri: URI,
  workspace: FoamWorkspace,
  contentRoot?: URI | null
) => {
  if (contentRoot && isWithinPath(uri, contentRoot)) {
    return trimSlashes(uri.relativeTo(contentRoot).path);
  }

  return getWorkspaceRelativePath(uri, workspace);
};

export const getNoteRoute = (
  resource: Resource,
  workspace: FoamWorkspace,
  contentRoot?: URI | null
) => {
  const relativePath = getContentRelativePath(resource.uri, workspace, contentRoot);
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
  const relativePath = getWorkspaceRelativePath(resource.uri, workspace);
  return `assets/${relativePath}`;
};

export const buildRouteManifest = (
  resources: Resource[],
  workspace: FoamWorkspace,
  contentRoot?: URI | null
): ExportedRoute[] =>
  resources
    .filter(resource => resource.type === 'note')
    .map(resource => ({
      sourceUri: resource.uri,
      route: getNoteRoute(resource, workspace, contentRoot),
    }))
    .sort(
      (left, right) =>
        left.sourceUri.path.localeCompare(right.sourceUri.path) ||
        left.route.localeCompare(right.route)
    );

export const buildAssetManifest = (
  resources: Resource[],
  workspace: FoamWorkspace
): ExportedAsset[] =>
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

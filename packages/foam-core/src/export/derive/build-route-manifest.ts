import { isWithinPath } from '../../utils/path';
import { URI } from '../../model/uri';
import { FoamWorkspace } from '../../model/workspace';

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

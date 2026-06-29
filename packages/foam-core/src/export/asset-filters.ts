import { Resource } from '../model/note';
import { isWithinPath } from '../utils/path';
import { ExportAssetContext, ExportAssetMatcher } from './types';

const includeAssetsInWorkspace = (): ExportAssetMatcher => {
  return () => true;
};

const includeAssetsInContentRoot = (): ExportAssetMatcher => {
  return (resource: Resource, context: ExportAssetContext) => {
    if (!context.contentRoot) {
      return true;
    }

    return isWithinPath(resource.uri.asPlain(), context.contentRoot);
  };
};

/**
 * Convenience factories for common export asset filters.
 *
 * These helpers produce `includeAsset` functions. They do not change the
 * export API surface, which stays centered on `includeAsset`.
 *
 * @example
 * await buildSite({
 *   workspace,
 *   contentRoot: 'docs/user',
 *   includeAsset: exportAssets.content(),
 * });
 */
export const exportAssets = {
  workspace: includeAssetsInWorkspace,
  content: includeAssetsInContentRoot,
};

import { Resource } from '../core/model/note';
import { isWithinPath } from '../core/utils/path';
import { PublishAssetContext, PublishAssetMatcher } from './types';

const includeAssetsInWorkspace = (): PublishAssetMatcher => {
  return () => true;
};

const includeAssetsInContentRoot = (): PublishAssetMatcher => {
  return (resource: Resource, context: PublishAssetContext) => {
    if (!context.contentRoot) {
      return true;
    }

    return isWithinPath(resource.uri.asPlain(), context.contentRoot);
  };
};

/**
 * Convenience factories for common publish asset filters.
 *
 * These helpers produce `includeAsset` functions. They do not change the
 * publish API surface, which stays centered on `includeAsset`.
 *
 * @example
 * await buildSite({
 *   workspace,
 *   contentRoot: 'docs/user',
 *   includeAsset: publishAssets.content(),
 * });
 */
export const publishAssets = {
  workspace: includeAssetsInWorkspace,
  content: includeAssetsInContentRoot,
};

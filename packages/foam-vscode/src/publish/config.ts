import { Resource } from '@foam/core';
import { publishAssets } from './asset-filters';
import { PublishAssetMatcher, PublishConfig, PublishIncludeMatcher } from './types';

export const getIncludeMatcher = (config: PublishConfig): PublishIncludeMatcher => {
  return (
    config.include ??
    ((resource: Resource) => {
      return resource.type === 'note';
    })
  );
};

/**
 * Resolves the asset matcher used during publish.
 */
export const getIncludeAssetMatcher = (
  config: PublishConfig
): PublishAssetMatcher => {
  return config.includeAsset ?? publishAssets.workspace();
};

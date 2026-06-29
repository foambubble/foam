import { Resource } from '@foam/core';
import { exportAssets } from './asset-filters';
import { ExportAssetMatcher, ExportConfig, ExportIncludeMatcher } from './types';

export const getIncludeMatcher = (config: ExportConfig): ExportIncludeMatcher => {
  return (
    config.include ??
    ((resource: Resource) => {
      return resource.type === 'note';
    })
  );
};

/**
 * Resolves the asset matcher used during export.
 */
export const getIncludeAssetMatcher = (
  config: ExportConfig
): ExportAssetMatcher => {
  return config.includeAsset ?? exportAssets.workspace();
};

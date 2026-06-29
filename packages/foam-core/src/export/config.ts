import { exportAssets } from './asset-filters';
import { ExportAssetMatcher, ExportConfig } from './types';

/**
 * Resolves the asset matcher used during export.
 */
export const getIncludeAssetMatcher = (
  config: ExportConfig
): ExportAssetMatcher => {
  return config.includeAsset ?? exportAssets.workspace();
};

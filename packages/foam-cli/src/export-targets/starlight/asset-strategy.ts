import {
  AssetResolution,
  AssetStrategy,
  ExportContext,
  getWorkspaceRelativePath,
  Resource,
  slugifyUrlPath,
} from '@foam/core';

/**
 * Starlight asset strategy: every linked asset is copied to
 * `public/assets/<slugified-path>`.
 */
export const starlightAssetStrategy: AssetStrategy = {
  resolve(asset: Resource, context: ExportContext): AssetResolution {
    const relativePath = getWorkspaceRelativePath(
      asset.uri,
      context.workspace
    );
    return {
      kind: 'file',
      outputPath: `assets/${slugifyUrlPath(relativePath, { preserveExtension: true })}`,
    };
  },
};

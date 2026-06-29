import { MarkdownLink } from '../src/services/markdown-link';
import { Resource } from '../src/model/note';
import { URI } from '../src/model/uri';
import { changeExtension } from '../src/utils/path';
import {
  getContentRelativePath,
  getWorkspaceRelativePath,
} from '../src/export/derive/build-route-manifest';
import { slugifyUrlPath } from '../src/export/slug';
import type {
  AssetResolution,
  AssetStrategy,
  ExportArtifactSet,
  ExportContext,
  LinkRewriteResult,
  PublishLocation,
  PublishLocator,
  PublishTarget,
  ResolvedLink,
  SourceLinkRewriter,
} from '../src/export';

const DIRECTORY_INDEX_NAMES = new Set(['index', 'readme']);

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

/**
 * Minimal `PublishTarget` for unit testing the core pipeline.
 *
 * Implements the same "slugified, markdown-link-rewriting, file-asset"
 * defaults that the historical (pre-target-interface) pipeline produced
 * — so existing core tests don't need to change their assertions when
 * they switch from `buildSite(config)` to `buildSite(config, testTarget())`.
 */
export const testExportTarget = (
  options: { onEmit?: (artifactSet: ExportArtifactSet) => void } = {}
): PublishTarget => {
  const locator: PublishLocator = {
    locate(uri: URI, context: ExportContext): PublishLocation | null {
      const resource = context.workspace.find(uri);
      if (!resource || resource.type !== 'note') {
        return null;
      }
      const relativePath = getContentRelativePath(
        resource.uri,
        context.workspace,
        context.contentRoot
      );
      const withoutExtension = changeExtension(
        relativePath,
        resource.uri.getExtension(),
        ''
      );
      const segments = trimSlashes(withoutExtension)
        .split('/')
        .filter(Boolean);

      let href: string;
      if (segments.length === 0) {
        href = '/';
      } else {
        const basename = segments[segments.length - 1].toLowerCase();
        if (DIRECTORY_INDEX_NAMES.has(basename)) {
          const parentPath = slugifyUrlPath(segments.slice(0, -1).join('/'));
          href = parentPath.length === 0 ? '/' : `/${parentPath}`;
        } else {
          href = `/${slugifyUrlPath(segments.join('/'))}`;
        }
      }

      return {
        href,
        sectionAnchor: (slug: string) => `${href}#${slug}`,
        sectionId: (slug: string) => slug,
      };
    },
  };

  const assetStrategy: AssetStrategy = {
    resolve(asset: Resource, context: ExportContext): AssetResolution {
      const relativePath = getWorkspaceRelativePath(asset.uri, context.workspace);
      return {
        kind: 'file',
        outputPath: `assets/${slugifyUrlPath(relativePath, { preserveExtension: true })}`,
      };
    },
  };

  const linkRewriter: SourceLinkRewriter = {
    rewrite(
      resolved: ResolvedLink,
      note: Resource
    ): LinkRewriteResult {
      const { original: link } = resolved;
      const analyzed = MarkdownLink.analyzeLink(link);

      if (resolved.resolution.kind === 'unresolved') {
        return { kind: 'leave' };
      }
      if (resolved.resolution.kind === 'excluded') {
        return { kind: 'leave' };
      }
      if (resolved.resolution.kind === 'in-set') {
        const { targetResource, location } = resolved.resolution;
        const target = targetResource.uri.isEqual(note.uri) ? '' : location.href;
        return {
          kind: 'edit',
          edit: MarkdownLink.createUpdateLinkEdit(link, {
            type: 'link',
            target,
            section: resolved.section,
            alias: analyzed.alias || targetResource.title,
          }),
        };
      }
      // in-set-asset
      const { targetResource, assetResolution } = resolved.resolution;
      if (assetResolution.kind !== 'file') {
        return { kind: 'leave' };
      }
      return {
        kind: 'edit',
        edit: MarkdownLink.createUpdateLinkEdit(link, {
          type: 'link',
          target: `/${assetResolution.outputPath}`,
          section: resolved.section,
          alias:
            analyzed.alias ||
            targetResource.title ||
            targetResource.uri.getBasename(),
        }),
      };
    },
  };

  return {
    locator,
    assetStrategy,
    linkRewriter,
    emit: async (artifactSet: ExportArtifactSet) => {
      options.onEmit?.(artifactSet);
    },
  };
};


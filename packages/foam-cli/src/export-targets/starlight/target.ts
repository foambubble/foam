import {
  ExportArtifactSet,
  PublishTarget,
} from '@foam/core';
import { starlightAssetStrategy } from './asset-strategy';
import { writeStarlightSite } from './index';
import { starlightLinkRewriter } from './link-rewriter';
import { starlightLocator } from './locator';

export interface StarlightTargetOptions {
  /** Directory the generated Astro/Starlight project will be written to. */
  outputDir: string;
  /** Public site URL (used for `<link rel="canonical">`, sitemap, etc.). */
  siteUrl?: string;
  /** Path to a prebuilt `foam-graph.standalone.js` bundle. */
  graphBundlePath?: string;
  /** Path to a favicon (SVG) to copy into `public/favicon.svg`. */
  faviconPath?: string;
  /**
   * When true (default) the scaffold files (`astro.config.mjs`,
   * `package.json`, components, etc.) are written. Set to false to keep
   * an existing scaffold in place — useful when callers run against an
   * already-configured Astro project.
   */
  includeProjectScaffold?: boolean;
}

/**
 * Implements `PublishTarget` for the Astro/Starlight emission family.
 *
 * The locator/asset-strategy/link-rewriter live in sibling files so they
 * can be reused (or replaced) piecewise by future Starlight-flavoured
 * targets. The `emit` method bridges to the existing `writeStarlightSite`
 * function — that function is the historical entry point and stays here
 * so older test code can call it directly.
 */
export class StarlightTarget implements PublishTarget {
  readonly locator = starlightLocator;
  readonly assetStrategy = starlightAssetStrategy;
  readonly linkRewriter = starlightLinkRewriter;

  constructor(private readonly options: StarlightTargetOptions) {}

  async emit(artifactSet: ExportArtifactSet): Promise<void> {
    await writeStarlightSite({
      artifactSet,
      outputDir: this.options.outputDir,
      siteUrl: this.options.siteUrl,
      graphBundlePath: this.options.graphBundlePath,
      faviconPath: this.options.faviconPath,
      includeProjectScaffold: this.options.includeProjectScaffold,
    });
  }
}

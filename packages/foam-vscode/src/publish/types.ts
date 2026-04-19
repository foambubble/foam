import { FoamGraph } from '../core/model/graph';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';

export interface PublishRuntimeContext {
  workspace: FoamWorkspace;
  graph: FoamGraph;
  contentRoot: URI | null;
}

export interface PublishSiteContext extends PublishRuntimeContext {
  notes: Resource[];
  routes: PublishedRoute[];
}

export type PublishValueResolver<TValue, TContext> =
  | TValue
  | ((context: TContext) => TValue);

export type PublishIncludeMatcher = (
  resource: Resource,
  context: PublishRuntimeContext
) => boolean;

/**
 * Context passed to `includeAsset`.
 *
 * Assets are only evaluated after they have been reached from links inside
 * notes that already passed `include`.
 */
export interface PublishAssetContext extends PublishRuntimeContext {
  /** The note set that made it into the published site. */
  publishedNotes: Resource[];
  /** Published notes that currently link to this asset. */
  linkedFrom: Resource[];
}

/**
 * Programmable asset filter.
 *
 * This is the asset-selection API for publish. Convenience helpers such as
 * `publishAssets.content()` produce values of this type.
 */
export type PublishAssetMatcher = (
  resource: Resource,
  context: PublishAssetContext
) => boolean;

export type PublishHomepageMatcher =
  | string
  | URI
  | Resource
  | ((note: Resource, context: PublishSiteContext) => boolean);

export interface PublishSiteConfig {
  title?: PublishValueResolver<string | undefined, PublishSiteContext>;
  description?: PublishValueResolver<string | undefined, PublishSiteContext>;
  homepage?: PublishHomepageMatcher;
}

export interface PublishConfig {
  workspace: FoamWorkspace;
  graph?: FoamGraph;
  contentRoot?: string | URI;
  /**
   * Selects which notes are publishable.
   */
  include?: PublishIncludeMatcher;
  /**
   * Selects which linked assets are publishable.
   */
  includeAsset?: PublishAssetMatcher;
  site?: PublishSiteConfig;
}

export interface PublishedBacklink {
  route: string;
  title: string;
  sourceUri: URI;
}

export interface PublishedNote {
  sourceUri: URI;
  route: string;
  title: string;
  description?: string;
  properties: Record<string, unknown>;
  markdown: string;
  backlinks: PublishedBacklink[];
}

export interface PublishedAsset {
  sourceUri: URI;
  outputPath: string;
}

export interface PublishedRoute {
  sourceUri: URI;
  route: string;
}

export interface PublishedSite {
  title?: string;
  description?: string;
  homepageRoute: string | null;
}

export interface PublishedDiagnostic {
  level: 'warning';
  code: 'unresolved-link';
  sourceUri: URI;
  sourceRoute: string;
  link: string;
  target: string;
  message: string;
}

export interface PublishArtifactSet {
  site: PublishedSite;
  notes: PublishedNote[];
  assets: PublishedAsset[];
  routes: PublishedRoute[];
  diagnostics: PublishedDiagnostic[];
}

export interface PublishContext extends PublishRuntimeContext {
  site?: PublishSiteConfig;
  include: (resource: Resource) => boolean;
  resources: Resource[];
  notes: Resource[];
  assets: Resource[];
  publishedRoutes: PublishedRoute[];
  publishedAssets: PublishedAsset[];
  noteRoutes: Map<string, string>;
  assetPaths: Map<string, string>;
}

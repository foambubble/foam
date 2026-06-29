import { FoamGraph } from '@foam/core';
import { Resource } from '@foam/core';
import { URI } from '@foam/core';
import { FoamWorkspace } from '@foam/core';

export interface ExportRuntimeContext {
  workspace: FoamWorkspace;
  graph: FoamGraph;
  contentRoot: URI | null;
}

export interface ExportSiteContext extends ExportRuntimeContext {
  notes: Resource[];
  routes: ExportedRoute[];
}

export type ExportValueResolver<TValue, TContext> =
  | TValue
  | ((context: TContext) => TValue);

export type ExportIncludeMatcher = (
  resource: Resource,
  context: ExportRuntimeContext
) => boolean;

/**
 * Context passed to `includeAsset`.
 *
 * Assets are only evaluated after they have been reached from links inside
 * notes that already passed `include`.
 */
export interface ExportAssetContext extends ExportRuntimeContext {
  /** The note set that made it into the exported site. */
  exportedNotes: Resource[];
  /** Exported notes that currently link to this asset. */
  linkedFrom: Resource[];
}

/**
 * Programmable asset filter.
 *
 * This is the asset-selection API for export. Convenience helpers such as
 * `exportAssets.content()` produce values of this type.
 */
export type ExportAssetMatcher = (
  resource: Resource,
  context: ExportAssetContext
) => boolean;

export type ExportHomepageMatcher =
  | string
  | URI
  | Resource
  | ((note: Resource, context: ExportSiteContext) => boolean);

export interface ExportSiteConfig {
  title?: ExportValueResolver<string | undefined, ExportSiteContext>;
  description?: ExportValueResolver<string | undefined, ExportSiteContext>;
  homepage?: ExportHomepageMatcher;
}

export interface ExportConfig {
  workspace: FoamWorkspace;
  graph?: FoamGraph;
  contentRoot?: string | URI;
  /**
   * Selects which notes are exportable.
   */
  include?: ExportIncludeMatcher;
  /**
   * Selects which linked assets are exportable.
   */
  includeAsset?: ExportAssetMatcher;
  site?: ExportSiteConfig;
}

export interface ExportedBacklink {
  route: string;
  title: string;
  sourceUri: URI;
}

export interface ExportedNote {
  sourceUri: URI;
  route: string;
  title: string;
  description?: string;
  properties: Record<string, unknown>;
  markdown: string;
  backlinks: ExportedBacklink[];
}

export interface ExportedAsset {
  sourceUri: URI;
  outputPath: string;
}

export interface ExportedRoute {
  sourceUri: URI;
  route: string;
}

export interface ExportedSite {
  title?: string;
  description?: string;
  homepageRoute: string | null;
}

/**
 * Runtime-compatible with the `GraphData` payload expected by `@foam/graph-view`.
 * Export keeps a local copy of the shape so targets can emit graph JSON
 * without depending on the site package at build time.
 */
export interface ExportedGraphNode {
  id: string;
  type: string;
  title: string;
  properties: { color?: string; [key: string]: unknown };
  tags: Array<{ label: string }>;
}

export interface ExportedGraphLink {
  source: string;
  target: string;
}

export interface ExportedGraphData {
  nodeInfo: Record<string, ExportedGraphNode>;
  links: ExportedGraphLink[];
}

export interface ExportedDiagnostic {
  level: 'warning';
  code: 'unresolved-link';
  sourceUri: URI;
  sourceRoute: string;
  link: string;
  target: string;
  message: string;
}

export interface ExportArtifactSet {
  site: ExportedSite;
  graph: ExportedGraphData;
  notes: ExportedNote[];
  assets: ExportedAsset[];
  routes: ExportedRoute[];
  diagnostics: ExportedDiagnostic[];
}

export interface ExportContext extends ExportRuntimeContext {
  site?: ExportSiteConfig;
  include: (resource: Resource) => boolean;
  resources: Resource[];
  notes: Resource[];
  assets: Resource[];
  exportedRoutes: ExportedRoute[];
  exportedAssets: ExportedAsset[];
  noteRoutes: Map<string, string>;
  assetPaths: Map<string, string>;
}

import { FoamGraph } from '../model/graph';
import { Resource } from '../model/note';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import type { AssetResolution, PublishLocation } from './target';

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

/**
 * Selects the notes that make it into the export, in the order they should
 * appear in the output. Stateful selection (e.g. BFS, foam-query results,
 * hand-picked URIs) belongs upstream of the pipeline: the caller computes
 * the list and hands it over.
 */
export type ExportSelector = (
  workspace: FoamWorkspace,
  graph: FoamGraph
) => Resource[];

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
   * Selects which notes (and in what order) the export emits. Defaults to
   * every note in workspace iteration order, scoped to `contentRoot` if set.
   * Use the `selectAll` / `selectByUris` helpers, a foam-query result, or a
   * hand-built `Resource[]` (e.g. the URIs the user picked in a quick-pick).
   */
  select?: ExportSelector;
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
  /** In selection order — same order the selector handed to the pipeline. */
  notes: ExportedNote[];
  /**
   * In asset-discovery order: the order assets were first encountered by
   * walking the selected notes' links.
   */
  assets: ExportedAsset[];
  /** In selection order — same as `notes`. */
  routes: ExportedRoute[];
  diagnostics: ExportedDiagnostic[];
}

export interface ExportContext extends ExportRuntimeContext {
  site?: ExportSiteConfig;
  include: (resource: Resource) => boolean;
  resources: Resource[];
  notes: Resource[];
  assets: Resource[];
  /**
   * Target-resolved location for each note, keyed by URI.path. Built by
   * walking `notes` through `target.locator.locate`. The canonical "where
   * does each note live in the output's address space" source — pipeline
   * derivations (routes manifest, graph IDs, backlinks) read from here.
   */
  locations: Map<string, PublishLocation>;
  /**
   * Target-resolved materialisation for each asset, keyed by URI.path.
   * Built by walking `assets` through `target.assetStrategy.resolve`.
   */
  assetResolutions: Map<string, AssetResolution>;
}

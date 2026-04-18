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
  include?: PublishIncludeMatcher;
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
  sourceRoute?: string;
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
  includeAsset: (resource: Resource) => boolean;
  resources: Resource[];
  notes: Resource[];
  assets: Resource[];
  noteRoutes: Map<string, string>;
  assetPaths: Map<string, string>;
}

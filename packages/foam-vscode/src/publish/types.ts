import { FoamGraph } from '../core/model/graph';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';

export interface PublishConfig {
  workspace: FoamWorkspace;
  graph?: FoamGraph;
  include?: (resource: Resource) => boolean;
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

export interface PublishArtifactSet {
  notes: PublishedNote[];
  assets: PublishedAsset[];
  routes: PublishedRoute[];
}

export interface PublishContext {
  workspace: FoamWorkspace;
  graph: FoamGraph;
  include: (resource: Resource) => boolean;
  noteRoutes: Map<string, string>;
  assetPaths: Map<string, string>;
}

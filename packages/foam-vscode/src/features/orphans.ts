import * as vscode from 'vscode';
import { Foam, FoamGraph, URI } from 'foam-core';
import { getOrphansConfig } from '../settings';
import { FoamFeature } from '../types';
import {
  GroupedResourcesTreeDataProvider,
  ResourceTreeItem,
  UriTreeItem,
} from '../utils/grouped-resources-tree-data-provider';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const workspacesURIs = vscode.workspace.workspaceFolders.map(
      dir => dir.uri
    );

    const provider = new GroupedResourcesTreeDataProvider(
      'orphans',
      'orphan',
      getOrphansConfig(),
      workspacesURIs,
      () => foam.graph.getAllNodes().filter(uri => isOrphan(uri, foam.graph)),
      uri => {
        if (URI.isPlaceholder(uri)) {
          return new UriTreeItem(uri);
        }
        const resource = foam.workspace.find(uri);
        return new ResourceTreeItem(resource, foam.workspace);
      }
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
      ...provider.commands,
      foam.workspace.onDidAdd(() => provider.refresh()),
      foam.workspace.onDidUpdate(() => provider.refresh()),
      foam.workspace.onDidDelete(() => provider.refresh())
    );
  },
};

export const isOrphan = (uri: URI, graph: FoamGraph) =>
  graph.getConnections(uri).length === 0;

export default feature;

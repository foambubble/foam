import * as vscode from 'vscode';
import { Foam, FoamGraph, Resource, URI } from 'foam-core';
import { getOrphansConfig } from '../settings';
import { FoamFeature } from '../types';
import { GroupedResourcesTreeDataProvider } from '../utils/grouped-resources-tree-data-provider';

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
      foam.workspace,
      foam.graph,
      foam.services.dataStore,
      'orphans',
      'orphan',
      (uri: URI, _index: number, graph: FoamGraph) => isOrphan(uri, graph),
      getOrphansConfig(),
      workspacesURIs
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
export default feature;

export function isOrphan(uri: URI, graph: FoamGraph) {
  return graph.getConnections(uri).length === 0;
}

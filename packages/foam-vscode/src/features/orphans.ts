import * as vscode from 'vscode';
import { Foam, FoamGraph, Resource } from 'foam-core';
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
      foam.services.dataStore,
      'orphans',
      'orphan',
      (resource: Resource) => isOrphan(foam.graph, resource),
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

export function isOrphan(graph: FoamGraph, resource: Resource) {
  return graph.getConnections(resource.uri).length === 0;
}

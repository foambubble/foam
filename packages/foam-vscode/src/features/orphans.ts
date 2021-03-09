import * as vscode from 'vscode';
import { Foam, FoamWorkspace, isNote, Resource } from 'foam-core';
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
      (resource: Resource) => isOrphan(foam.workspace, resource),
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

export function isOrphan(workspace: FoamWorkspace, resource: Resource) {
  if (isNote(resource)) {
    return workspace.getConnections(resource.uri).length === 0;
  } else {
    return false;
  }
}

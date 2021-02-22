import * as vscode from 'vscode';
import { Foam, FoamWorkspace, isNote, Resource } from 'foam-core';
import { FilteredResourcesConfigGroupBy, getOrphansConfig } from '../settings';
import { FoamFeature } from '../types';
import { FilteredResourcesProvider } from './filtered-resources';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesFsPaths = vscode.workspace.workspaceFolders.map(
      dir => dir.uri.fsPath
    );
    const provider = new FilteredResourcesProvider(
      foam.workspace,
      foam.services.dataStore,
      'orphans',
      'orphan',
      (resource: Resource) => isOrphan(foam.workspace, resource),
      {
        ...getOrphansConfig(),
        workspacesFsPaths,
      }
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
      vscode.commands.registerCommand(
        'foam-vscode.group-orphans-by-folder',
        () => provider.setGroupBy(FilteredResourcesConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand('foam-vscode.group-orphans-off', () =>
        provider.setGroupBy(FilteredResourcesConfigGroupBy.Off)
      ),
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

import * as vscode from 'vscode';
import { Resource, URI } from 'foam-core';
import { getOrphansConfig } from '../settings';
import { FoamFeature } from '../types';
import {
  GroupedResourcesTreeDataProvider,
  ResourceTreeItem,
  UriTreeItem,
} from '../utils/grouped-resources-tree-data-provider';
import { VsCodeAwareFoam } from '../utils/vsc-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<VsCodeAwareFoam>
  ) => {
    const foam = await foamPromise;

    const workspacesURIs = vscode.workspace.workspaceFolders.map(
      dir => dir.uri
    );

    const provider = new GroupedResourcesTreeDataProvider(
      'orphans',
      'orphan',
      () =>
        foam.graph
          .getAllNodes()
          .filter(uri => foam.graph.getConnections(uri).length === 0),
      uri =>
        URI.isPlaceholder(uri)
          ? new UriTreeItem(uri)
          : new ResourceTreeItem(foam.workspace.find(uri), foam.workspace),
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

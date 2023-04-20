import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import { getOrphansConfig } from '../../settings';
import { FoamFeature } from '../../types';
import { GroupedResourcesTreeDataProvider } from '../../utils/grouped-resources-tree-data-provider';
import { ResourceTreeItem, UriTreeItem } from '../../utils/tree-view-utils';

const EXCLUDE_TYPES = ['image', 'attachment'];
const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const { matcher } = await createMatcherAndDataStore(
      getOrphansConfig().exclude
    );
    const provider = new GroupedResourcesTreeDataProvider(
      'orphans',
      'orphan',
      context.globalState,
      () =>
        foam.graph
          .getAllNodes()
          .filter(
            uri =>
              !EXCLUDE_TYPES.includes(foam.workspace.find(uri)?.type) &&
              foam.graph.getConnections(uri).length === 0
          ),
      uri => {
        return uri.isPlaceholder()
          ? new UriTreeItem(uri)
          : new ResourceTreeItem(foam.workspace.find(uri), foam.workspace);
      },
      matcher
    );

    const treeView = vscode.window.createTreeView('foam-vscode.orphans', {
      treeDataProvider: provider,
      showCollapseAll: true,
    });
    provider.refresh();
    const baseTitle = treeView.title;
    treeView.title = baseTitle + ` (${provider.numElements})`;

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
      provider,
      foam.graph.onDidUpdate(() => {
        provider.refresh();
        treeView.title = baseTitle + ` (${provider.numElements})`;
      })
    );
  },
};

export default feature;

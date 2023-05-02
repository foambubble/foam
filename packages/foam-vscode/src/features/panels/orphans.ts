import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import { getOrphansConfig } from '../../settings';
import { FoamFeature } from '../../types';
import { GroupedResourcesTreeDataProvider } from '../../utils/grouped-resources-tree-data-provider';
import { ResourceTreeItem, UriTreeItem } from '../../utils/tree-view-utils';
import { IMatcher } from '../../core/services/datastore';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamGraph } from '../../core/model/graph';

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
    const provider = new OrphanTreeView(
      context.globalState,
      foam.workspace,
      foam.graph,
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

export class OrphanTreeView extends GroupedResourcesTreeDataProvider {
  constructor(
    state: vscode.Memento,
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    matcher: IMatcher
  ) {
    super('orphans', 'orphan', state, matcher);
  }

  createTreeItem = uri => {
    return uri.isPlaceholder()
      ? new UriTreeItem(uri)
      : new ResourceTreeItem(this.workspace.find(uri), this.workspace);
  };

  computeResources = () =>
    this.graph
      .getAllNodes()
      .filter(
        uri =>
          !EXCLUDE_TYPES.includes(this.workspace.find(uri)?.type) &&
          this.graph.getConnections(uri).length === 0
      );
}

export default feature;

import * as vscode from 'vscode';
import { Foam, listOrphans } from '@foam/core';
import { createMatcherAndDataStore } from '../../services/editor';
import { Config } from '@foam/core';
import {
  GroupedResourcesConfig,
  GroupedResourcesTreeDataProvider,
} from '../../utils/tree-views/grouped-resources-tree-data-provider';
import { ResourceTreeItem, UriTreeItem } from '../../utils/tree-views/tree-view-utils';
import { IMatcher } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { FoamGraph } from '@foam/core';
export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const { matcher } = await createMatcherAndDataStore(
    Config.getFilesInclude(),
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
  treeView.title = baseTitle + ` (${provider.nValues})`;

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
    provider,
    treeView,
    foam.graph.onDidUpdate(() => {
      provider.refresh();
      treeView.title = baseTitle + ` (${provider.nValues})`;
    })
  );
}

/** Retrieve the orphans configuration */
export function getOrphansConfig(): GroupedResourcesConfig {
  const orphansConfig = vscode.workspace.getConfiguration('foam.orphans');
  const exclude: string[] = orphansConfig.get('exclude') ?? [];
  return { exclude };
}

export class OrphanTreeView extends GroupedResourcesTreeDataProvider {
  constructor(
    state: vscode.Memento,
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    matcher: IMatcher
  ) {
    super('orphans', state, matcher);
  }

  createValueTreeItem = uri => {
    return uri.isPlaceholder()
      ? new UriTreeItem(uri)
      : new ResourceTreeItem(this.workspace.find(uri), this.workspace);
  };

  getUris = () =>
    listOrphans(this.workspace, this.graph, {
      ignoreOutgoingExcludedTypes: true,
    }).map(item => item.uri);
}

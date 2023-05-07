import * as vscode from 'vscode';
import { URI } from '../../core/model/uri';
import { isNone } from '../../utils';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamGraph } from '../../core/model/graph';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  createBacklinkItemsForResource,
  groupRangesByResource,
} from './utils/tree-view-utils';
import { BaseTreeProvider } from './utils/base-tree-provider';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const provider = new BacklinksTreeDataProvider(foam.workspace, foam.graph);
  const treeView = vscode.window.createTreeView('foam-vscode.backlinks', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  const baseTitle = treeView.title;

  const updateTarget = async () => {
    provider.target = vscode.window.activeTextEditor
      ? fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
      : undefined;
    await provider.refresh();
    treeView.title = baseTitle + ` (${provider.nValues})`;
  };

  updateTarget();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('foam-vscode.backlinks', provider),
    foam.graph.onDidUpdate(() => provider.refresh()),
    vscode.window.onDidChangeActiveTextEditor(() => updateTarget()),
    provider
  );
}

export class BacklinksTreeDataProvider extends BaseTreeProvider<vscode.TreeItem> {
  public target?: URI = undefined;
  public nValues = 0;
  private backlinkItems: ResourceRangeTreeItem[];

  constructor(private workspace: FoamWorkspace, private graph: FoamGraph) {
    super();
  }

  async refresh(): Promise<void> {
    const uri = this.target;

    const backlinkItems =
      isNone(uri) || isNone(this.workspace.find(uri))
        ? []
        : await createBacklinkItemsForResource(this.workspace, this.graph, uri);

    this.backlinkItems = backlinkItems;
    this.nValues = backlinkItems.length;
    super.refresh();
  }

  async getChildren(item?: BacklinkPanelTreeItem): Promise<vscode.TreeItem[]> {
    if (item && item instanceof ResourceTreeItem) {
      return item.getChildren();
    }

    return groupRangesByResource(
      this.workspace,
      this.backlinkItems,
      vscode.TreeItemCollapsibleState.Expanded
    );
  }
}

type BacklinkPanelTreeItem = ResourceTreeItem | ResourceRangeTreeItem;

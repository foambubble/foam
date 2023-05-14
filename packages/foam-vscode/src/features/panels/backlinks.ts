import * as vscode from 'vscode';
import { URI } from '../../core/model/uri';
import { isNone } from '../../utils';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { Connection, FoamGraph } from '../../core/model/graph';
import { Range } from '../../core/model/range';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import {
  BaseTreeItem,
  ResourceRangeTreeItem,
  ResourceTreeItem,
  UriTreeItem,
  createBacklinkItemsForResource,
  createConnectionItemsForResource,
  groupRangesByResource,
} from './utils/tree-view-utils';
import { BaseTreeProvider } from './utils/base-tree-provider';
import { groupBy } from 'lodash';
import { Resource } from '../../core/model/note';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const provider = new ConnectionsTreeDataProvider(foam.workspace, foam.graph);
  const treeView = vscode.window.createTreeView('foam-vscode.connections', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  const baseTitle = treeView.title;

  const updateTreeView = async () => {
    provider.target = vscode.window.activeTextEditor
      ? fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
      : undefined;
    await provider.refresh();
    treeView.title = baseTitle + ` (${provider.nValues})`;
  };

  updateTreeView();

  context.subscriptions.push(
    provider,
    treeView,
    foam.graph.onDidUpdate(() => updateTreeView()),
    vscode.window.onDidChangeActiveTextEditor(() => updateTreeView())
  );
}

export class ConnectionsTreeDataProvider extends BaseTreeProvider<vscode.TreeItem> {
  public target?: URI = undefined;
  public nValues = 0;
  private connectionItems: ResourceRangeTreeItem[];

  constructor(private workspace: FoamWorkspace, private graph: FoamGraph) {
    super();
    this.disposables.push();
  }

  async refresh(): Promise<void> {
    const uri = this.target;

    const connectionItems =
      isNone(uri) || isNone(this.workspace.find(uri))
        ? []
        : await createConnectionItemsForResource(
            this.workspace,
            this.graph,
            uri
          );

    this.connectionItems = connectionItems;
    this.nValues = connectionItems.length;
    super.refresh();
  }

  async getChildren(item?: BacklinkPanelTreeItem): Promise<vscode.TreeItem[]> {
    if (item && item instanceof BaseTreeItem) {
      return item.getChildren();
    }

    const byResource = this.connectionItems.reduce((acc, item) => {
      const connection = item.value as Connection;
      const uri = connection.source.asPlain().isEqual(this.target)
        ? connection.target
        : connection.source;
      acc.set(uri.toString(), [...(acc.get(uri.toString()) ?? []), item]);
      return acc;
    }, new Map() as Map<string, ResourceRangeTreeItem[]>);

    const resourceItems = [];
    for (const [uriString, items] of byResource.entries()) {
      const uri = URI.parse(uriString);
      const item = uri.isPlaceholder()
        ? new UriTreeItem(uri, {
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          })
        : new ResourceTreeItem(items[0].resource, this.workspace, {
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          });
      const children = items.sort((a, b) => Range.isBefore(a.range, b.range));
      item.getChildren = () => Promise.resolve(children);
      item.description = `(${items.length}) ${item.description}`;
      item.command = children[0].command;
      resourceItems.push(item);
    }
    resourceItems.sort((a, b) => a.label.localeCompare(b.label));
    return resourceItems;
  }
}

type BacklinkPanelTreeItem = ResourceTreeItem | ResourceRangeTreeItem;

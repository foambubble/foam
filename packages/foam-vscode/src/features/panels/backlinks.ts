import * as vscode from 'vscode';
import { URI } from '../../core/model/uri';

import { isNone } from '../../utils';
import { FoamFeature } from '../../types';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamGraph } from '../../core/model/graph';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  groupRangesByResource,
} from '../../utils/tree-view-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const provider = new BacklinksTreeDataProvider(foam.workspace, foam.graph);

    vscode.window.onDidChangeActiveTextEditor(async () => {
      provider.target = vscode.window.activeTextEditor
        ? fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
        : undefined;
      await provider.refresh();
    });

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.backlinks', provider),
      foam.graph.onDidUpdate(() => provider.refresh())
    );
  },
};
export default feature;

export class BacklinksTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  public target?: URI = undefined;
  // prettier-ignore
  private _onDidChangeTreeDataEmitter = new vscode.EventEmitter<BacklinkPanelTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeDataEmitter.event;

  constructor(private workspace: FoamWorkspace, private graph: FoamGraph) {}

  refresh(): void {
    this._onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(item: BacklinkPanelTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(item?: BacklinkPanelTreeItem): Promise<vscode.TreeItem[]> {
    const uri = this.target;
    if (item && item instanceof ResourceTreeItem) {
      return item.getChildren();
    }

    if (isNone(uri) || isNone(this.workspace.find(uri))) {
      return Promise.resolve([]);
    }

    const backlinkItems = BacklinksTreeDataProvider.createForResource(
      this.workspace,
      this.graph,
      uri
    );

    return groupRangesByResource(
      this.workspace,
      backlinkItems,
      vscode.TreeItemCollapsibleState.Expanded
    );
  }

  resolveTreeItem(item: BacklinkPanelTreeItem): Promise<BacklinkPanelTreeItem> {
    return item.resolveTreeItem();
  }

  static createForResource(
    workspace: FoamWorkspace,
    graph: FoamGraph,
    uri: URI
  ) {
    const connections = graph
      .getConnections(uri)
      .filter(c => c.target.asPlain().isEqual(uri));

    const backlinkItems = connections.map(c =>
      ResourceRangeTreeItem.createStandardItem(
        workspace,
        workspace.get(c.source),
        c.link.range
      )
    );
    return Promise.all(backlinkItems);
  }
}

type BacklinkPanelTreeItem = ResourceTreeItem | ResourceRangeTreeItem;

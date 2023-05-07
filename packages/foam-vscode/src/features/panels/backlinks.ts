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

  const updateTarget = () => {
    provider.target = vscode.window.activeTextEditor
      ? fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
      : undefined;
    provider.refresh();
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

  constructor(private workspace: FoamWorkspace, private graph: FoamGraph) {
    super();
  }

  getChildren(item?: BacklinkPanelTreeItem): Promise<vscode.TreeItem[]> {
    const uri = this.target;
    if (item && item instanceof ResourceTreeItem) {
      return item.getChildren();
    }

    if (isNone(uri) || isNone(this.workspace.find(uri))) {
      return Promise.resolve([]);
    }

    const backlinkItems = createBacklinkItemsForResource(
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
}

type BacklinkPanelTreeItem = ResourceTreeItem | ResourceRangeTreeItem;

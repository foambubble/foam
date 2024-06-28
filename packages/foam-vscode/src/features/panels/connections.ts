import * as vscode from 'vscode';
import { URI } from '../../core/model/uri';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { Connection, FoamGraph } from '../../core/model/graph';
import { Range } from '../../core/model/range';
import { ContextMemento, fromVsCodeUri } from '../../utils/vsc-utils';
import {
  BaseTreeItem,
  ResourceRangeTreeItem,
  ResourceTreeItem,
  UriTreeItem,
  createConnectionItemsForResource,
} from './utils/tree-view-utils';
import { BaseTreeProvider } from './utils/base-tree-provider';
import { isNone } from '../../core/utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const provider = new ConnectionsTreeDataProvider(
    foam.workspace,
    foam.graph,
    context.globalState
  );
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
  };

  updateTreeView();

  context.subscriptions.push(
    provider,
    treeView,
    foam.graph.onDidUpdate(() => updateTreeView()),
    vscode.window.onDidChangeActiveTextEditor(() => updateTreeView()),
    provider.onDidChangeTreeData(() => {
      treeView.title = ` ${provider.show.get()} (${provider.nValues})`;
    })
  );
}

export class ConnectionsTreeDataProvider extends BaseTreeProvider<vscode.TreeItem> {
  public show = new ContextMemento<'all links' | 'backlinks' | 'forward links'>(
    this.state,
    `foam-vscode.views.connections.show`,
    'all links',
    true
  );
  public target?: URI = undefined;
  public nValues = 0;
  private connectionItems: ResourceRangeTreeItem[] = [];

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    public state: vscode.Memento,
    registerCommands = true // for testing. don't love it, but will do for now
  ) {
    super();
    if (!registerCommands) {
      return;
    }
    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.connections.show:all-links`,
        () => {
          this.show.update('all links');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.connections.show:backlinks`,
        () => {
          this.show.update('backlinks');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.connections.show:forward-links`,
        () => {
          this.show.update('forward links');
          this.refresh();
        }
      )
    );
  }

  async refresh(): Promise<void> {
    const uri = this.target;

    const connectionItems =
      isNone(uri) || isNone(this.workspace.find(uri))
        ? []
        : await createConnectionItemsForResource(
            this.workspace,
            this.graph,
            uri,
            (connection: Connection) => {
              const isBacklink = connection.target
                .asPlain()
                .isEqual(this.target);
              return (
                this.show.get() === 'all links' ||
                (isBacklink && this.show.get() === 'backlinks') ||
                (!isBacklink && this.show.get() === 'forward links')
              );
            }
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
      const isBacklink = connection.target.asPlain().isEqual(this.target);
      const uri = isBacklink ? connection.source : connection.target;
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
        : new ResourceTreeItem(this.workspace.get(uri), this.workspace, {
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          });
      const children = items.sort((a, b) => {
        return (
          a.variant.localeCompare(b.variant) || Range.isBefore(a.range, b.range)
        );
      });
      item.getChildren = () => Promise.resolve(children);
      item.description = `(${items.length}) ${item.description}`;
      // item.iconPath = children.every(c => c.variant === children[0].variant)
      //   ? children[0].iconPath
      //   : new vscode.ThemeIcon(
      //       'arrow-swap',
      //       new vscode.ThemeColor('charts.purple')
      //     );
      resourceItems.push(item);
    }
    resourceItems.sort((a, b) => a.label.localeCompare(b.label));
    return resourceItems;
  }
}

type BacklinkPanelTreeItem = ResourceTreeItem | ResourceRangeTreeItem;

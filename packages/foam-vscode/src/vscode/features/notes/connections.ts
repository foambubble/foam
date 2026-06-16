import * as vscode from 'vscode';
import { URI } from '@foam/core';
import { Foam } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { Connection, FoamGraph } from '@foam/core';
import { Range } from '@foam/core';
import { ContextMemento } from '../../utils/vsc-utils';
import {
  BaseTreeItem,
  ResourceRangeTreeItem,
  ResourceTreeItem,
  UriTreeItem,
  createConnectionItemsForResource,
} from '../../utils/tree-views/tree-view-utils';
import { BaseTreeProvider } from '../../utils/tree-views/base-tree-provider';
import { isNone } from '@foam/core';
import {
  getActiveTabUri,
  getWorkspaceDefaultScheme,
  onDidChangeActiveTab,
} from '../../services/editor';

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

  const onActiveTabChanged = async () => {
    const next = getActiveTabUri(foam.workspace);
    if (next === undefined) {
      return;
    }
    if (provider.target?.toString() === next.toString()) {
      return;
    }
    provider.target = next;
    await provider.refresh();
  };

  onActiveTabChanged();

  context.subscriptions.push(
    provider,
    treeView,
    foam.graph.onDidUpdate(() => provider.refresh()),
    onDidChangeActiveTab(() => onActiveTabChanged()),
    provider.onDidChangeTreeData(() => {
      treeView.title = ` ${provider.show.get()} (${provider.nValues})`;
    })
  );
}

export class ConnectionsTreeDataProvider extends BaseTreeProvider<vscode.TreeItem> {
  public show: ContextMemento<'all links' | 'backlinks' | 'forward links'>;
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
    this.show = new ContextMemento<'all links' | 'backlinks' | 'forward links'>(
      this.state,
      `foam-vscode.views.connections.show`,
      'all links',
      true
    );
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
      const uri = URI.parse(uriString, getWorkspaceDefaultScheme());
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

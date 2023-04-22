import { URI } from '../../core/model/uri';
import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
} from '../../utils/tree-view-utils';
import { Resource } from '../../core/model/note';
import { FoamGraph } from '../../core/model/graph';
import { BacklinksTreeDataProvider } from './backlinks';
import { toVsCodeUri } from '../../utils/vsc-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const provider = new NotesProvider(foam.workspace, foam.graph);
    provider.refresh();
    const treeView = vscode.window.createTreeView(
      'foam-vscode.notes-explorer',
      {
        treeDataProvider: provider,
        showCollapseAll: true,
      }
    );
    context.subscriptions.push(
      treeView,
      foam.workspace.onDidUpdate(() => {
        provider.refresh();
      })
    );
  },
};

export default feature;

export class FolderTreeItem extends vscode.TreeItem {
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  contextValue = 'folder';
  iconPath = new vscode.ThemeIcon('folder');

  constructor(public parent: Directory, public name: string) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
  }
}

export type NotesTreeItems =
  | ResourceTreeItem
  | FolderTreeItem
  | ResourceRangeTreeItem;

export class NotesProvider implements vscode.TreeDataProvider<NotesTreeItems> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<
  NotesTreeItems | undefined | void
  > = new vscode.EventEmitter<NotesTreeItems | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<NotesTreeItems | undefined | void> =
    this._onDidChangeTreeData.event;
  private root: Directory = {};

  constructor(private workspace: FoamWorkspace, private graph: FoamGraph) {}

  refresh(): void {
    this.root = createTreeStructure(this.workspace);
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item) {
    return item;
  }

  async getChildren(item?: NotesTreeItems): Promise<NotesTreeItems[]> {
    if (item instanceof ResourceTreeItem) {
      return item.getChildren() as Promise<NotesTreeItems[]>;
    }
    if (item instanceof ResourceRangeTreeItem) {
      return [];
    }

    const parent = item?.parent ?? this.root;

    const children = Object.keys(parent).map(name => {
      const value = parent[name];
      if ((value as Resource)?.uri) {
        const res = new ResourceTreeItem(value as Resource, this.workspace, {
          collapsibleState:
            this.graph.getBacklinks((value as Resource).uri).length > 0
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
          getChildren: async () => {
            const backlinks = await BacklinksTreeDataProvider.createForResource(
              this.workspace,
              this.graph,
              res.uri
            );
            backlinks.forEach(b => {
              b.iconPath = new vscode.ThemeIcon(
                'arrow-left',
                new vscode.ThemeColor('charts.purple')
              );
            });
            return backlinks;
          },
        });
        res.iconPath = vscode.ThemeIcon.File;
        res.resourceUri = toVsCodeUri(res.uri);
        return res;
      }
      return new FolderTreeItem(value as Directory, name);
    });
    return children.sort((a, b) => {
      // Both a and b are FolderTreeItem instances
      if (a instanceof FolderTreeItem && b instanceof FolderTreeItem) {
        return a.label.toString().localeCompare(b.label.toString());
      }

      // Only a is a FolderTreeItem instance
      if (a instanceof FolderTreeItem) {
        return -1;
      }

      // Only b is a FolderTreeItem instance
      if (b instanceof FolderTreeItem) {
        return 1;
      }

      return a.label.toString().localeCompare(b.label.toString());
    });
  }

  async resolveTreeItem(item: NotesTreeItems): Promise<NotesTreeItems> {
    if ((item as any)?.resolveTreeItem) {
      return (item as any).resolveTreeItem();
    }
    return Promise.resolve(item);
  }
}

interface Directory {
  [key: string]: Directory | Resource;
}

function createTreeStructure(workspace: FoamWorkspace): Directory {
  const root: Directory = {};

  for (const r of workspace.resources()) {
    const path = vscode.workspace.asRelativePath(
      r.uri.path,
      vscode.workspace.workspaceFolders.length > 1
    );
    const parts = path.split('/');
    let currentNode: Directory = root;

    parts.forEach((part, index) => {
      if (!currentNode[part]) {
        currentNode[part] = index === parts.length - 1 ? r : {};
      }
      currentNode = currentNode[part] as Directory;
    });
  }

  return root;
}

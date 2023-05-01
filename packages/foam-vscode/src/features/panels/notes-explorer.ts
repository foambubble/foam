import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  createBacklinkItemsForResource as createBacklinkTreeItemsForResource,
} from '../../utils/tree-view-utils';
import { Resource } from '../../core/model/note';
import { FoamGraph } from '../../core/model/graph';
import { ContextMemento, toVsCodeUri } from '../../utils/vsc-utils';
import { IDisposable } from '../../core/common/lifecycle';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const provider = new NotesProvider(
      foam.workspace,
      foam.graph,
      context.globalState
    );
    provider.refresh();
    const treeView = vscode.window.createTreeView<NotesTreeItems>(
      'foam-vscode.notes-explorer',
      {
        treeDataProvider: provider,
        showCollapseAll: true,
        canSelectMany: true,
      }
    );
    context.subscriptions.push(
      treeView,
      provider,
      foam.graph.onDidUpdate(() => {
        provider.refresh();
      }),
      vscode.window.onDidChangeActiveTextEditor(async () => {
        const target = vscode.window.activeTextEditor?.document.uri;
        if (treeView.visible) {
          if (target) {
            const item = await provider.findTreeItem(target);
            // Check if the item is already selected.
            // This check is needed because always calling reveal() will
            // cause the tree view to take the focus from the item when
            // browsing the notes explorer
            if (
              !treeView.selection.find(
                i => i.resourceUri.path === item.resourceUri.path
              )
            ) {
              treeView.reveal(item);
            }
          }
        }
      }),
      treeView.onDidChangeVisibility(async () => {
        if (treeView.visible) {
          const target = vscode.window.activeTextEditor?.document.uri;
          if (target) {
            const item = await provider.findTreeItem(target);
            treeView.reveal(item);
          }
        }
      })
    );
  },
};

export default feature;

export class FolderTreeItem extends vscode.TreeItem {
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  contextValue = 'folder';
  iconPath = new vscode.ThemeIcon('folder');

  constructor(
    public parent: Directory,
    public name: string,
    public parentElement?: FolderTreeItem
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
  }
}

export type NotesTreeItems =
  | ResourceTreeItem
  | FolderTreeItem
  | ResourceRangeTreeItem;

export class NotesProvider
  implements vscode.TreeDataProvider<NotesTreeItems>, IDisposable
{
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<NotesTreeItems | undefined | void> = new vscode.EventEmitter<NotesTreeItems | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<NotesTreeItems | undefined | void> = this._onDidChangeTreeData.event;

  public show = new ContextMemento<'all' | 'notes-only'>(
    this.state,
    `foam-vscode.views.notes-explorer.show`,
    'all'
  );

  private root: Directory = {};
  protected disposables: vscode.Disposable[] = [];

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private state: vscode.Memento
  ) {
    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.notes-explorer.show:all`,
        () => {
          this.show.update('all');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.notes-explorer.show:notes`,
        () => {
          this.show.update('notes-only');
          this.refresh();
        }
      )
    );
  }

  refresh(): void {
    this.root = createTreeStructure(
      this.workspace,
      this.show.get() === 'notes-only'
        ? r => r.type !== 'image' && r.type !== 'attachment'
        : () => true
    );
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item) {
    return item;
  }

  getParent(element: NotesTreeItems): vscode.ProviderResult<NotesTreeItems> {
    if (element instanceof ResourceTreeItem) {
      return Promise.resolve(element.parent as NotesTreeItems);
    }
    if (element instanceof FolderTreeItem) {
      return Promise.resolve(element.parentElement);
    }
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
        return this.createResourceTreeItem(value as Resource);
      } else {
        return new FolderTreeItem(value as Directory, name, item);
      }
    });

    return children.sort(sortNotesExplorerItems);
  }

  private createResourceTreeItem(value: Resource, parent?: FolderTreeItem) {
    const res = new ResourceTreeItem(value, this.workspace, {
      parent,
      collapsibleState:
        this.graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      getChildren: async () => {
        const backlinks = await createBacklinkTreeItemsForResource(
          this.workspace,
          this.graph,
          res.uri
        );
        return backlinks;
      },
    });
    res.iconPath = vscode.ThemeIcon.File;
    res.resourceUri = toVsCodeUri(res.uri);
    return res;
  }

  async resolveTreeItem(item: NotesTreeItems): Promise<NotesTreeItems> {
    if ((item as any)?.resolveTreeItem) {
      return (item as any).resolveTreeItem();
    }
    return Promise.resolve(item);
  }

  getTreeItemsHierarchy(uri: vscode.Uri, root: Directory): vscode.TreeItem[] {
    const path = vscode.workspace.asRelativePath(uri, true);
    const parts = path.split('/').filter(p => p.length > 0);
    const treeItemsHierarchy: vscode.TreeItem[] = [];
    let currentNode: Directory | Resource = root;

    for (const part of parts) {
      if (currentNode[part] !== undefined) {
        currentNode = currentNode[part] as Directory | Resource;
        if ((currentNode as Resource).uri) {
          treeItemsHierarchy.push(
            this.createResourceTreeItem(
              currentNode as Resource,
              treeItemsHierarchy[
                treeItemsHierarchy.length - 1
              ] as FolderTreeItem
            )
          );
        } else {
          treeItemsHierarchy.push(
            new FolderTreeItem(
              currentNode as Directory,
              part,
              treeItemsHierarchy[
                treeItemsHierarchy.length - 1
              ] as FolderTreeItem
            )
          );
        }
      } else {
        // If a part is not found in the tree structure, the given URI is not valid.
        return [];
      }
    }

    return treeItemsHierarchy;
  }

  findTreeItem(target: vscode.Uri): Promise<NotesTreeItems> {
    const hierarchy = this.getTreeItemsHierarchy(target, this.root);
    return hierarchy.length > 0
      ? Promise.resolve(hierarchy.pop())
      : Promise.resolve(null);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

function sortNotesExplorerItems(
  a: ResourceTreeItem | FolderTreeItem,
  b: ResourceTreeItem | FolderTreeItem
): number {
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
}

interface Directory {
  [key: string]: Directory | Resource;
}

function createTreeStructure(
  workspace: FoamWorkspace,
  filterFn: (r: Resource) => boolean
): Directory {
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
        if (index < parts.length - 1) {
          currentNode[part] = {};
        } else {
          if (filterFn(r)) {
            currentNode[part] = r;
          }
        }
      }
      currentNode = currentNode[part] as Directory;
    });
  }

  return root;
}

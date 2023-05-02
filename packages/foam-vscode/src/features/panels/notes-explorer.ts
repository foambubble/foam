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
    const revealTextEditorItem = async () => {
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
    };

    context.subscriptions.push(
      treeView,
      provider,
      foam.graph.onDidUpdate(() => {
        provider.refresh();
      }),
      vscode.window.onDidChangeActiveTextEditor(revealTextEditorItem),
      treeView.onDidChangeVisibility(revealTextEditorItem)
    );
  },
};

export default feature;

export type NotesTreeItems =
  | ResourceTreeItem
  | FolderTreeItem<Resource>
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

  private root: Folder<Resource> = {};
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
        return new FolderTreeItem(value as Folder<Resource>, name, item);
      }
    });

    return children.sort(sortFolderTreeItems);
  }

  private createResourceTreeItem(
    value: Resource,
    parent?: FolderTreeItem<Resource>
  ) {
    const res = new ResourceTreeItem(value, this.workspace, {
      parent,
      collapsibleState:
        this.graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    });
    res.getChildren = async () => {
      const backlinks = await createBacklinkTreeItemsForResource(
        this.workspace,
        this.graph,
        res.uri
      );
      return backlinks;
    };
    return res;
  }

  async resolveTreeItem(item: NotesTreeItems): Promise<NotesTreeItems> {
    if ((item as any)?.resolveTreeItem) {
      return (item as any).resolveTreeItem();
    }
    return Promise.resolve(item);
  }

  findTreeItem(target: vscode.Uri): Promise<NotesTreeItems> {
    const hierarchy = getTreeItemsHierarchy(
      vscode.workspace.asRelativePath(target, true),
      this.root,
      value => value.uri != null,
      (value, parent) => this.createResourceTreeItem(value, parent)
    );
    return hierarchy.length > 0
      ? Promise.resolve(hierarchy.pop())
      : Promise.resolve(null);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

function sortFolderTreeItems<T>(
  a: ResourceTreeItem | FolderTreeItem<T>,
  b: ResourceTreeItem | FolderTreeItem<T>
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

function createTreeStructure(
  workspace: FoamWorkspace,
  filterFn: (r: Resource) => boolean
): Folder<Resource> {
  const root: Folder<Resource> = {};

  for (const r of workspace.resources()) {
    const path = vscode.workspace.asRelativePath(
      r.uri.path,
      vscode.workspace.workspaceFolders.length > 1
    );
    const parts = path.split('/');
    let currentNode: Folder<Resource> = root;

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
      currentNode = currentNode[part] as Folder<Resource>;
    });
  }

  return root;
}

interface Folder<T> {
  [basename: string]: Folder<T> | T;
}

export class FolderTreeItem<T> extends vscode.TreeItem {
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  contextValue = 'folder';
  iconPath = new vscode.ThemeIcon('folder');

  constructor(
    public parent: Folder<T>,
    public name: string,
    public parentElement?: FolderTreeItem<T>
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
  }
}

function getTreeItemsHierarchy<T>(
  path: string,
  root: Folder<T>,
  isValueType: (value: T) => boolean,
  createLeaf: (value: T, parent?: FolderTreeItem<T>) => ResourceTreeItem
): vscode.TreeItem[] {
  const parts = path.split('/').filter(p => p.length > 0);
  const treeItemsHierarchy: vscode.TreeItem[] = [];
  let currentNode: Folder<T> | T = root;

  for (const part of parts) {
    if (currentNode[part] !== undefined) {
      currentNode = currentNode[part] as Folder<T> | T;
      if (isValueType(currentNode as T)) {
        treeItemsHierarchy.push(
          createLeaf(
            currentNode as T,
            treeItemsHierarchy[
              treeItemsHierarchy.length - 1
            ] as FolderTreeItem<T>
          )
        );
      } else {
        treeItemsHierarchy.push(
          new FolderTreeItem(
            currentNode as Folder<T>,
            part,
            treeItemsHierarchy[
              treeItemsHierarchy.length - 1
            ] as FolderTreeItem<T>
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

import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import {
  BaseTreeItem,
  ResourceRangeTreeItem,
  ResourceTreeItem,
  createBacklinkItemsForResource as createBacklinkTreeItemsForResource,
} from '../../utils/tree-view-utils';
import { Resource } from '../../core/model/note';
import { FoamGraph } from '../../core/model/graph';
import { ContextMemento } from '../../utils/vsc-utils';
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
      this.workspace.list(),
      res => {
        const path = vscode.workspace.asRelativePath(
          res.uri.path,
          vscode.workspace.workspaceFolders.length > 1
        );
        const parts = path.split('/');
        return parts;
      },
      this.show.get() === 'notes-only'
        ? res => res.type !== 'image' && res.type !== 'attachment'
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
    if (item instanceof BaseTreeItem) {
      return item.getChildren() as Promise<NotesTreeItems[]>;
    }

    const parent = item?.parent ?? this.root;

    const children = Object.keys(parent).map(name => {
      const value = parent[name];
      if ((value as Resource)?.uri) {
        return this.createResourceTreeItem(
          value as Resource,
          this.workspace,
          this.graph
        );
      } else {
        return new FolderTreeItem(value as Folder<Resource>, name, item);
      }
    });

    return children.sort(sortFolderTreeItems);
  }

  private createResourceTreeItem(
    value: Resource,
    workspace: FoamWorkspace,
    graph: FoamGraph,
    parent?: FolderTreeItem<Resource>
  ) {
    const res = new ResourceTreeItem(value, workspace, {
      parent,
      collapsibleState:
        graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    });
    res.getChildren = async () => {
      const backlinks = await createBacklinkTreeItemsForResource(
        workspace,
        graph,
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
      this.root,
      vscode.workspace.asRelativePath(target, true).split('/'),
      value => value.uri != null,
      (value, parent) =>
        this.createResourceTreeItem(value, this.workspace, this.graph, parent)
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

function createTreeStructure<T>(
  values: T[],
  valueToPath: (value: T) => string[],
  filterFn: (value: T) => boolean
): Folder<T> {
  const root: Folder<T> = {};

  for (const r of values) {
    const parts = valueToPath(r);
    let currentNode: Folder<T> = root;

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
      currentNode = currentNode[part] as Folder<T>;
    });
  }

  return root;
}

function getTreeItemsHierarchy<T>(
  root: Folder<T>,
  path: string[],
  isValueType: (value: T) => boolean,
  createLeaf: (value: T, parent?: FolderTreeItem<T>) => ResourceTreeItem
): vscode.TreeItem[] {
  const treeItemsHierarchy: vscode.TreeItem[] = [];
  let currentNode: Folder<T> | T = root;

  for (const part of path) {
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

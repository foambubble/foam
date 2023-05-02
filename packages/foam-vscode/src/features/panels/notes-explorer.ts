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
import { BaseTreeProvider } from './utils/base-tree-provider';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    // const folderTree = new FolderTree<Resource>(
    //   value => (value as Resource)?.uri != null,
    //   (value, parent) =>
    //     createResourceTreeItem(value, foam.workspace, foam.graph, parent),
    //   value => {
    //     const path = vscode.workspace.asRelativePath(
    //       value.uri.path,
    //       vscode.workspace.workspaceFolders.length > 1
    //     );
    //     const parts = path.split('/');
    //     return parts;
    //   }
    // );
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

export class NotesProvider extends BaseTreeProvider<NotesTreeItems> {
  public show = new ContextMemento<'all' | 'notes-only'>(
    this.state,
    `foam-vscode.views.notes-explorer.show`,
    'all'
  );
  private root: Folder<Resource>;

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private state: vscode.Memento
  ) {
    super();
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
    this.createFolders();
    super.refresh();
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
      if (this.isValueType(value as Resource)) {
        return this.createLeafItem(value as Resource, undefined);
      } else {
        return new FolderTreeItem(value as Folder<Resource>, name, item);
      }
    });

    return children.sort(sortFolderTreeItems);
  }

  createTree(
    values: Resource[],
    filterFn: (value: Resource) => boolean
  ): Folder<Resource> {
    const root: Folder<Resource> = {};

    for (const r of values) {
      const parts = this.valueToPath(r);
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

  getTreeItemsHierarchy(
    root: Folder<Resource>,
    path: string[]
  ): vscode.TreeItem[] {
    const treeItemsHierarchy: vscode.TreeItem[] = [];
    let currentNode: Folder<Resource> | Resource = root;

    for (const part of path) {
      if (currentNode[part] !== undefined) {
        currentNode = currentNode[part] as Folder<Resource> | Resource;
        if (this.isValueType(currentNode as Resource)) {
          treeItemsHierarchy.push(
            this.createLeafItem(
              currentNode as Resource,
              treeItemsHierarchy[
                treeItemsHierarchy.length - 1
              ] as FolderTreeItem<Resource>
            )
          );
        } else {
          treeItemsHierarchy.push(
            new FolderTreeItem(
              currentNode as Folder<Resource>,
              part,
              treeItemsHierarchy[
                treeItemsHierarchy.length - 1
              ] as FolderTreeItem<Resource>
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

  findTreeItem(uri: vscode.Uri): Promise<NotesTreeItems> {
    const path = vscode.workspace.asRelativePath(
      uri,
      vscode.workspace.workspaceFolders.length > 1
    );
    const parts = path.split('/');
    const hierarchy = this.getTreeItemsHierarchy(this.root, parts);
    return hierarchy.length > 0
      ? Promise.resolve(hierarchy.pop())
      : Promise.resolve(null);
  }

  valueToPath(value: Resource) {
    const path = vscode.workspace.asRelativePath(
      value.uri.path,
      vscode.workspace.workspaceFolders.length > 1
    );
    const parts = path.split('/');
    return parts;
  }

  createFolders() {
    this.root = this.createTree(
      this.workspace.list(),
      this.show.get() === 'notes-only'
        ? res => res.type !== 'image' && res.type !== 'attachment'
        : () => true
    );
  }

  isValueType(value: Resource): value is Resource {
    return (value as Resource)?.uri != null;
  }

  createLeafItem(
    value: Resource,
    parent: FolderTreeItem<Resource>
  ): NotesTreeItems {
    return createResourceTreeItem(
      value as Resource,
      this.workspace,
      this.graph,
      parent
    );
  }
}

function createResourceTreeItem(
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

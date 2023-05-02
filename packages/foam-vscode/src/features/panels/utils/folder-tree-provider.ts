import * as vscode from 'vscode';
import { BaseTreeProvider } from './base-tree-provider';
import { BaseTreeItem, ResourceTreeItem } from '../../../utils/tree-view-utils';

export interface Folder<T> {
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

export abstract class FolderTreeProvider<I, T> extends BaseTreeProvider<I> {
  private root: Folder<T>;

  refresh(): void {
    this.createTree(this.getValues(), this.getFilterFn());
    super.refresh();
  }

  getParent(element: I | FolderTreeItem<T>): vscode.ProviderResult<I> {
    if (element instanceof ResourceTreeItem) {
      return Promise.resolve(element.parent as I);
    }
    if (element instanceof FolderTreeItem) {
      return Promise.resolve(element.parentElement as any);
    }
  }

  async getChildren(item?: I): Promise<I[]> {
    if (item instanceof BaseTreeItem) {
      return item.getChildren() as Promise<I[]>;
    }

    const parent = (item as any)?.parent ?? this.root;

    const children: vscode.TreeItem[] = Object.keys(parent).map(name => {
      const value = parent[name];
      if (this.isValueType(value)) {
        return this.createValueTreeItem(value, undefined);
      } else {
        return new FolderTreeItem<T>(
          value as Folder<T>,
          name,
          item as unknown as FolderTreeItem<T>
        );
      }
    });

    return children.sort((a, b) => sortFolderTreeItems(a, b)) as any;
  }

  createTree(values: T[], filterFn: (value: T) => boolean): Folder<T> {
    const root: Folder<T> = {};

    for (const r of values) {
      const parts = this.valueToPath(r);
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

    this.root = root;
    return root;
  }

  getTreeItemsHierarchy(path: string[]): vscode.TreeItem[] {
    const treeItemsHierarchy: vscode.TreeItem[] = [];
    let currentNode: Folder<T> | T = this.root;

    for (const part of path) {
      if (currentNode[part] !== undefined) {
        currentNode = currentNode[part] as Folder<T> | T;
        if (this.isValueType(currentNode as T)) {
          treeItemsHierarchy.push(
            this.createValueTreeItem(
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

  findTreeItemByPath(path: string[]): Promise<I> {
    const hierarchy = this.getTreeItemsHierarchy(path);
    return hierarchy.length > 0
      ? Promise.resolve(hierarchy.pop())
      : Promise.resolve(null);
  }

  abstract valueToPath(value: T);

  abstract getValues(): T[];

  abstract getFilterFn(): (value: T) => boolean;

  abstract isValueType(value: T): value is T;

  abstract createValueTreeItem(value: T, parent: FolderTreeItem<T>): I;
}

function sortFolderTreeItems(a: vscode.TreeItem, b: vscode.TreeItem): number {
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

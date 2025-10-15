import * as vscode from 'vscode';
import { BaseTreeProvider } from './base-tree-provider';
import { BaseTreeItem, ResourceTreeItem } from './tree-view-utils';

/**
 * A folder is a map of basenames to either folders or values (e.g. resources).
 */
export interface Folder<T> {
  children: {
    [basename: string]: Folder<T>;
  };
  value?: T;
  path: string[];
}

/**
 * A TreeItem that represents a folder.
 */
export class FolderTreeItem<T> extends vscode.TreeItem {
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  contextValue = 'folder';

  constructor(
    public node: Folder<T>,
    public name: string,
    public parentElement?: FolderTreeItem<T>
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
  }
}

/**
 * An abstract class that can be used to create a tree view from a Folder object.
 * Its abstract methods must be implemented by the subclass to define the type of
 * the values in the folder, and how to filter them.
 */
export abstract class FolderTreeProvider<I, T> extends BaseTreeProvider<I> {
  private root: Folder<T>;
  public nValues = 0;

  refresh(): void {
    const values = this.getValues();
    this.nValues = values.length;
    this.createTree(values, this.getFilterFn());
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

  createFolderTreeItem(
    node: Folder<T>,
    name: string,
    parent: FolderTreeItem<T>
  ) {
    return new FolderTreeItem<T>(node, name, parent);
  }

  async getChildren(item?: I): Promise<I[]> {
    if (item instanceof BaseTreeItem) {
      return item.getChildren() as Promise<I[]>;
    }

    const parent: Folder<T> = (item as any)?.node ?? this.root;

    const children: vscode.TreeItem[] = Object.keys(parent?.children ?? []).map(
      name => {
        const node = parent.children[name];
        if (node.value != null) {
          return this.createValueTreeItem(
            node.value,
            item as FolderTreeItem<T>,
            node
          );
        } else {
          return this.createFolderTreeItem(
            node,
            name,
            item as unknown as FolderTreeItem<T>
          );
        }
      }
    );

    return children.sort((a, b) => sortFolderTreeItems(a, b)) as any;
  }

  createTree(values: T[], filterFn: (value: T) => boolean): Folder<T> {
    const root: Folder<T> = {
      children: {},
      path: [],
    };

    for (const r of values) {
      const parts = this.valueToPath(r);
      let currentNode: Folder<T> = root;

      parts.forEach((part, index) => {
        if (!currentNode.children[part]) {
          if (index < parts.length - 1) {
            currentNode.children[part] = {
              children: {},
              path: parts.slice(0, index + 1),
            };
          } else if (filterFn(r)) {
            currentNode.children[part] = {
              children: {},
              path: parts.slice(0, index + 1),
              value: r,
            };
          }
        }
        currentNode = currentNode.children[part];
      });
    }

    this.root = root;
    return root;
  }

  getTreeItemsHierarchy(path: string[]): vscode.TreeItem[] {
    const treeItemsHierarchy: vscode.TreeItem[] = [];
    let currentNode: Folder<T> = this.root;

    for (const part of path) {
      if (currentNode.children[part] !== undefined) {
        currentNode = currentNode.children[part] as Folder<T>;
        if (currentNode.value) {
          treeItemsHierarchy.push(
            this.createValueTreeItem(
              currentNode.value,
              treeItemsHierarchy[
                treeItemsHierarchy.length - 1
              ] as FolderTreeItem<T>,
              currentNode
            )
          );
        } else {
          treeItemsHierarchy.push(
            new FolderTreeItem(
              currentNode,
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

  /**
   * Returns a function that can be used to filter the values.
   * The difference between using this function vs not including the values
   * is that in this case, the tree will be created with all the folders
   * and subfolders, but the values will only be displayed if they pass
   * the filter.
   * By default it doesn't filter anything.
   */
  getFilterFn(): (value: T) => boolean {
    return () => true;
  }

  /**
   * Converts a value to a path of strings that can be used to create a tree.
   */
  abstract valueToPath(value: T);

  /**
   * Returns all the values that should be displayed in the tree.
   */
  abstract getValues(): T[];

  /**
   * Creates a tree item for the given value.
   */
  abstract createValueTreeItem(
    value: T,
    parent: FolderTreeItem<T>,
    node: Folder<T>
  ): I;
}

/**
 * walks the node and performs an action on each value
 * @returns
 */
export function walk<T, R>(node: Folder<T>, fn: (value: T) => R): R[] {
  const results: R[] = [];

  function traverse(node: Folder<T>) {
    if (node.value) {
      results.push(fn(node.value));
    }

    Object.values(node.children).forEach(child => {
      traverse(child);
    });
  }

  traverse(node);

  return results;
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

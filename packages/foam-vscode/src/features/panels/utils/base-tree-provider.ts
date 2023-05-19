import * as vscode from 'vscode';
import { IDisposable } from '../../../core/common/lifecycle';

/**
 * This class is a wrapper around vscode.TreeDataProvider that adds a few
 * features:
 * - It adds a `refresh()` method that can be called to refresh the tree view
 * - It adds a `resolveTreeItem()` method that can be used to resolve the
 *   tree item asynchronously. This is useful when the tree item needs to
 *   fetch data from the file system or from the network.
 * - It adds a `dispose()` method that can be used to dispose of any resources
 *   that the tree provider might be holding on to.
 */
export abstract class BaseTreeProvider<T>
  implements vscode.TreeDataProvider<T>, IDisposable
{
  protected disposables: vscode.Disposable[] = [];

  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<T | undefined | void> = new vscode.EventEmitter<T | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<T | undefined | void> = this._onDidChangeTreeData.event;

  abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

  getTreeItem(element: T) {
    return element;
  }

  async resolveTreeItem(item: T): Promise<T> {
    if ((item as any)?.resolveTreeItem) {
      return (item as any).resolveTreeItem();
    }
    return Promise.resolve(item);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

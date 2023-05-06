import * as vscode from 'vscode';
import { IDisposable } from 'packages/foam-vscode/src/core/common/lifecycle';

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

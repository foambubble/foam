import * as path from 'path';
import * as vscode from 'vscode';
import { URI } from '../../../core/model/uri';
import { IMatcher } from '../../../core/services/datastore';
import { UriTreeItem } from './tree-view-utils';
import { ContextMemento } from '../../../utils/vsc-utils';
import {
  FolderTreeItem,
  FolderTreeProvider,
  Folder,
} from './folder-tree-provider';

export interface GroupedResourcesConfig {
  exclude: string[];
}

type GroupedResourceTreeItem = UriTreeItem | FolderTreeItem<URI>;

/**
 * Provides the ability to expose a TreeDataExplorerView in VSCode. This class will
 * iterate over each Resource in the FoamWorkspace, call the provided filter predicate, and
 * display the Resources.
 *
 * **NOTE**: In order for this provider to correctly function, you must define the following command in the package.json file:
 * ```
 * foam-vscode.views.${providerId}.group-by-folder
 * foam-vscode.views.${providerId}.group-off
 * ```
 * Where `providerId` is the same string provided to the constructor.
 * @export
 * @class GroupedResourcesTreeDataProvider
 * @implements {vscode.TreeDataProvider<GroupedResourceTreeItem>}
 */
export abstract class GroupedResourcesTreeDataProvider extends FolderTreeProvider<
  GroupedResourceTreeItem,
  URI
> {
  public groupBy = new ContextMemento<'off' | 'folder'>(
    this.state,
    `foam-vscode.views.${this.providerId}.group-by`,
    'folder'
  );

  /**
   * Creates an instance of GroupedResourcesTreeDataProvider.
   * **NOTE**: In order for this provider to correctly function, you must define the following command in the package.json file:
   * ```
   * foam-vscode.views.${this.providerId}.group-by:folder
   * foam-vscode.views.${this.providerId}.group-by:off
   * ```
   * Where `providerId` is the same string provided to this constructor.
   *
   * @param {string} providerId A **unique** providerId, this will be used to generate necessary commands within the provider.
   * @param {vscode.Memento} state The state to use for persisting the panel settings.
   * @param {IMatcher} matcher The matcher to use for filtering the uris.
   * @memberof GroupedResourcesTreeDataProvider
   */
  constructor(
    protected providerId: string,
    protected state: vscode.Memento,
    private matcher: IMatcher
  ) {
    super();
    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.group-by:folder`,
        () => {
          this.groupBy.update('folder');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.group-by:off`,
        () => {
          this.groupBy.update('off');
          this.refresh();
        }
      )
    );
  }

  valueToPath(value: URI) {
    const p = vscode.workspace.asRelativePath(
      value.path,
      vscode.workspace.workspaceFolders.length > 1
    );
    if (this.groupBy.get() === 'folder') {
      const { dir, base } = path.parse(p);
      return [dir, base];
    }
    return [p];
  }

  getValues(): URI[] {
    const uris = this.getUris();
    return uris.filter(uri => this.matcher.isMatch(uri));
  }

  createFolderTreeItem(
    node: Folder<URI>,
    name: string,
    parent: FolderTreeItem<URI>
  ) {
    const item = super.createFolderTreeItem(node, name, parent);
    item.label = item.label || '(Not Created)';
    item.description = `(${Object.keys(node.children).length})`;
    return item;
  }

  /**
   * Return the URIs before the filtering by the matcher is applied
   */
  abstract getUris(): URI[];
}

import * as path from 'path';
import * as vscode from 'vscode';
import { GroupedResoucesConfigGroupBy } from '../settings';
import { getContainsTooltip, isSome } from '../utils';
import { URI } from '../core/model/uri';
import { IMatcher } from '../core/services/datastore';
import { UriTreeItem } from './tree-view-utils';

/**
 * Provides the ability to expose a TreeDataExplorerView in VSCode. This class will
 * iterate over each Resource in the FoamWorkspace, call the provided filter predicate, and
 * display the Resources.
 *
 * **NOTE**: In order for this provider to correctly function, you must define the following command in the package.json file:
   * ```
   * foam-vscode.group-${providerId}-by-folder
   * foam-vscode.group-${providerId}-off
   * ```
   * Where `providerId` is the same string provided to the constructor. You must also register the commands in your context subscriptions as follows:
   * ```
   * const provider = new GroupedResourcesTreeDataProvider(
      ...
    );
    context.subscriptions.push(
       vscode.window.registerTreeDataProvider(
       'foam-vscode.placeholders',
       provider
       ),
       ...provider.commands,
    );
    ```
 * @export
 * @class GroupedResourcesTreeDataProvider
 * @implements {vscode.TreeDataProvider<GroupedResourceTreeItem>}
 */
export class GroupedResourcesTreeDataProvider
  implements vscode.TreeDataProvider<GroupedResourceTreeItem>
{
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<GroupedResourceTreeItem | undefined | void> = new vscode.EventEmitter<GroupedResourceTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<GroupedResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;
  // prettier-ignore
  private groupBy: GroupedResoucesConfigGroupBy = GroupedResoucesConfigGroupBy.Folder;
  private exclude: string[] = [];
  private flatUris: Array<URI> = [];
  private root = vscode.workspace.workspaceFolders[0].uri.path;

  /**
   * Creates an instance of GroupedResourcesTreeDataProvider.
   * **NOTE**: In order for this provider to correctly function, you must define the following command in the package.json file:
   * ```
   * foam-vscode.group-${providerId}-by-folder
   * foam-vscode.group-${providerId}-off
   * ```
   * Where `providerId` is the same string provided to this constructor. You must also register the commands in your context subscriptions as follows:
   * ```
   * const provider = new GroupedResourcesTreeDataProvider(
      ...
    );
    context.subscriptions.push(
       vscode.window.registerTreeDataProvider(
       'foam-vscode.placeholders',
       provider
       ),
       ...provider.commands,
    );
    ```
   * @param {string} providerId A **unique** providerId, this will be used to generate necessary commands within the provider.
   * @param {string} resourceName A display name used in the explorer view
   * @param {() => Array<URI>} computeResources
   * @param {(item: URI) => GroupedResourceTreeItem} createTreeItem
   * @param {GroupedResourcesConfig} config
   * @param {URI[]} workspaceUris The workspace URIs
   * @memberof GroupedResourcesTreeDataProvider
   */
  constructor(
    private providerId: string,
    private resourceName: string,
    private computeResources: () => Array<URI>,
    private createTreeItem: (item: URI) => GroupedResourceTreeItem,
    private matcher: IMatcher
  ) {
    this.setContext();
    this.doComputeResources();
  }

  public get commands() {
    return [
      vscode.commands.registerCommand(
        `foam-vscode.group-${this.providerId}-by-folder`,
        () => this.setGroupBy(GroupedResoucesConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand(
        `foam-vscode.group-${this.providerId}-off`,
        () => this.setGroupBy(GroupedResoucesConfigGroupBy.Off)
      ),
    ];
  }

  public get numElements() {
    return this.flatUris.length;
  }

  setGroupBy(groupBy: GroupedResoucesConfigGroupBy): void {
    this.groupBy = groupBy;
    this.setContext();
    this.refresh();
  }

  private setContext(): void {
    vscode.commands.executeCommand(
      'setContext',
      `foam-vscode.${this.providerId}-grouped-by-folder`,
      this.groupBy === GroupedResoucesConfigGroupBy.Folder
    );
  }

  refresh(): void {
    this.doComputeResources();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: GroupedResourceTreeItem): vscode.TreeItem {
    return item;
  }

  async getChildren(
    item?: GroupedResourceTreeItem
  ): Promise<GroupedResourceTreeItem[]> {
    if ((item as any)?.getChildren) {
      const children = await (item as any).getChildren();
      return children.sort(sortByTreeItemLabel);
    }
    if (this.groupBy === GroupedResoucesConfigGroupBy.Folder) {
      const directories = Object.entries(this.getUrisByDirectory())
        .sort(([dir1], [dir2]) => sortByString(dir1, dir2))
        .map(
          ([dir, children]) =>
            new DirectoryTreeItem(
              dir,
              children.map(this.createTreeItem),
              this.resourceName
            )
        );
      return Promise.resolve(directories);
    }

    const items = this.flatUris
      .map(uri => this.createTreeItem(uri))
      .sort(sortByTreeItemLabel);
    return Promise.resolve(items);
  }

  resolveTreeItem(
    item: GroupedResourceTreeItem
  ): Promise<GroupedResourceTreeItem> {
    return item.resolveTreeItem();
  }

  private doComputeResources(): void {
    this.flatUris = this.computeResources()
      .filter(uri => this.matcher.isMatch(uri))
      .filter(isSome);
  }

  private getUrisByDirectory(): UrisByDirectory {
    const resourcesByDirectory: UrisByDirectory = {};
    for (const uri of this.flatUris) {
      const p = uri.path.replace(this.root, '');
      const { dir } = path.parse(p);

      if (resourcesByDirectory[dir]) {
        resourcesByDirectory[dir].push(uri);
      } else {
        resourcesByDirectory[dir] = [uri];
      }
    }
    return resourcesByDirectory;
  }
}

type UrisByDirectory = { [key: string]: Array<URI> };

type GroupedResourceTreeItem = UriTreeItem | DirectoryTreeItem;

export class DirectoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly dir: string,
    public readonly children: Array<GroupedResourceTreeItem>,
    itemLabel: string
  ) {
    super(dir || 'Not Created', vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.children.length > 1 ? 's' : '';
    this.description = `${this.children.length} ${itemLabel}${s}`;
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';

  resolveTreeItem(): Promise<GroupedResourceTreeItem> {
    const titles = this.children
      .map(c => c.label?.toString())
      .sort(sortByString);
    this.tooltip = getContainsTooltip(titles);
    return Promise.resolve(this);
  }

  getChildren(): Promise<GroupedResourceTreeItem[]> {
    return Promise.resolve(this.children);
  }
}

const sortByTreeItemLabel = (a: vscode.TreeItem, b: vscode.TreeItem) =>
  a.label.toString().localeCompare(b.label.toString());

const sortByString = (a: string, b: string) =>
  a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());

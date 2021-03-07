import * as path from 'path';
import * as vscode from 'vscode';
import {
  IDataStore,
  URI,
  FoamWorkspace,
  Resource,
  isPlaceholder,
  getTitle,
} from 'foam-core';
import micromatch from 'micromatch';
import {
  GroupedResourcesConfig,
  GroupedResoucesConfigGroupBy,
} from '../settings';
import { getContainsTooltip, getNoteTooltip } from '../utils';
import { OPEN_PLACEHOLDER_NOTE_COMMAND } from '../features/utility-commands';

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
  implements vscode.TreeDataProvider<GroupedResourceTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<GroupedResourceTreeItem | undefined | void> = new vscode.EventEmitter<GroupedResourceTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<GroupedResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;
  // prettier-ignore
  private groupBy: GroupedResoucesConfigGroupBy = GroupedResoucesConfigGroupBy.Folder;
  private exclude: string[] = [];
  private resources: Resource[] = [];
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
   * @param {FoamWorkspace} workspace
   * @param {IDataStore} dataStore
   * @param {string} providerId A **unique** providerId, this will be used to generate necessary commands within the provider.
   * @param {string} resourceName A display name used in the explorer view
   * @param {(resource: Resource, index: number) => boolean} filterPredicate A filter function called on each Resource within the workspace
   * @param {GroupedResourcesConfig} config
   * @param {URI[]} workspaceUris The workspace URIs
   * @memberof GroupedResourcesTreeDataProvider
   */
  constructor(
    private workspace: FoamWorkspace,
    private dataStore: IDataStore,
    private providerId: string,
    private resourceName: string,
    private filterPredicate: (resource: Resource, index: number) => boolean,
    config: GroupedResourcesConfig,
    workspaceUris: URI[]
  ) {
    this.groupBy = config.groupBy;
    this.exclude = this.getGlobs(workspaceUris, config.exclude);
    this.setContext();
    this.computeResources();
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
    this.computeResources();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: GroupedResourceTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(
    directory?: DirectoryTreeItem
  ): Thenable<GroupedResourceTreeItem[]> {
    if (!directory && this.groupBy === GroupedResoucesConfigGroupBy.Folder) {
      const directories = Object.entries(this.getGroupedResourcesByDirectory())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([dir, resources]) =>
            new DirectoryTreeItem(dir, resources, this.resourceName)
        );
      return Promise.resolve(directories);
    }

    if (directory) {
      const resources = directory.resources.map(
        o => new ResourceTreeItem(o, this.dataStore)
      );
      return Promise.resolve(resources);
    }

    const resources = this.resources.map(
      o => new ResourceTreeItem(o, this.dataStore)
    );
    return Promise.resolve(resources);
  }

  resolveTreeItem(
    item: GroupedResourceTreeItem
  ): Promise<GroupedResourceTreeItem> {
    return item.resolveTreeItem();
  }

  private computeResources(): void {
    this.resources = this.workspace
      .list()
      .filter(this.filterPredicate)
      .filter(resource => !this.isMatch(resource.uri))
      .sort(this.sort);
  }

  private isMatch(uri: URI) {
    return micromatch.isMatch(uri.fsPath, this.exclude);
  }

  private getGlobs(fsURI: URI[], globs: string[]): string[] {
    globs = globs.map(glob => (glob.startsWith('/') ? glob.slice(1) : glob));

    const exclude: string[] = [];

    for (const fsPath of fsURI) {
      let folder = fsPath.path.replace(/\\/g, '/');
      if (folder.substr(-1) === '/') {
        folder = folder.slice(0, -1);
      }
      exclude.push(...globs.map(g => `${folder}/${g}`));
    }

    return exclude;
  }

  private getGroupedResourcesByDirectory(): ResourceByDirectory {
    const resourcesByDirectory: ResourceByDirectory = {};
    for (const resource of this.resources) {
      const p = resource.uri.path.replace(this.root, '');
      const { dir } = path.parse(p);

      if (resourcesByDirectory[dir]) {
        resourcesByDirectory[dir].push(resource);
      } else {
        resourcesByDirectory[dir] = [resource];
      }
    }

    for (const k in resourcesByDirectory) {
      resourcesByDirectory[k].sort(this.sort);
    }

    return resourcesByDirectory;
  }

  private sort(a: Resource, b: Resource) {
    const titleA = getTitle(a);
    const titleB = getTitle(b);
    return titleA.localeCompare(titleB);
  }
}

type ResourceByDirectory = { [key: string]: Resource[] };

type GroupedResourceTreeItem = ResourceTreeItem | DirectoryTreeItem;

export class ResourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly resource: Resource,
    private readonly dataStore: IDataStore,
    collapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(getTitle(resource), collapsibleState);
    this.contextValue = 'resource';
    this.description = resource.uri.path.replace(
      vscode.workspace.getWorkspaceFolder(resource.uri)?.uri.path,
      ''
    );
    this.tooltip = undefined;
    if (isPlaceholder(resource)) {
      this.command = {
        command: OPEN_PLACEHOLDER_NOTE_COMMAND.command,
        title: OPEN_PLACEHOLDER_NOTE_COMMAND.title,
        arguments: [resource.uri],
      };
    } else {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [resource.uri],
      };
    }

    let iconStr: string;
    switch (this.resource.type) {
      case 'attachment':
        iconStr = 'file-media';
        break;
      case 'placeholder':
        iconStr = 'new-file';
        break;
      case 'note':
      default:
        iconStr = 'note';
        break;
    }
    this.iconPath = new vscode.ThemeIcon(iconStr);
  }

  async resolveTreeItem(): Promise<ResourceTreeItem> {
    if (this instanceof ResourceTreeItem) {
      const content = await this.dataStore?.read(this.resource.uri);
      this.tooltip = content
        ? getNoteTooltip(content)
        : getTitle(this.resource);
    }
    return this;
  }
}

export class DirectoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly dir: string,
    public readonly resources: Resource[],
    itemLabel: string
  ) {
    super(dir || 'Not Created', vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.resources.length > 1 ? 's' : '';
    this.description = `${this.resources.length} ${itemLabel}${s}`;
    const titles = this.resources.map(getTitle);
    this.tooltip = getContainsTooltip(titles);
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';

  resolveTreeItem(): Promise<GroupedResourceTreeItem> {
    return Promise.resolve(this);
  }
}

import * as path from 'path';
import * as vscode from 'vscode';
import micromatch from 'micromatch';
import {
  GroupedResourcesConfig,
  GroupedResoucesConfigGroupBy,
} from '../settings';
import { getContainsTooltip, getNoteTooltip, isSome } from '../utils';
import { OPEN_COMMAND } from '../features/utility-commands';
import { toVsCodeUri } from './vsc-utils';
import { URI } from '../core/model/uri';
import { Resource } from '../core/model/note';
import { FoamWorkspace } from '../core/model/workspace';

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
    config: GroupedResourcesConfig,
    workspaceUris: URI[],
    private computeResources: () => Array<URI>,
    private createTreeItem: (item: URI) => GroupedResourceTreeItem
  ) {
    this.groupBy = config.groupBy;
    this.exclude = this.getGlobs(workspaceUris, config.exclude);
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

  getChildren(
    directory?: DirectoryTreeItem
  ): Thenable<GroupedResourceTreeItem[]> {
    if (this.groupBy === GroupedResoucesConfigGroupBy.Folder) {
      if (isSome(directory)) {
        return Promise.resolve(directory.children.sort(sortByTreeItemLabel));
      }
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
      .filter(uri => !this.isMatch(uri))
      .filter(isSome);
  }

  private isMatch(uri: URI) {
    return micromatch.isMatch(uri.toFsPath(), this.exclude);
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

export class UriTreeItem extends vscode.TreeItem {
  constructor(
    public readonly uri: URI,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      icon?: string;
      title?: string;
    } = {}
  ) {
    super(options?.title ?? uri.getName(), options.collapsibleState);
    this.description = uri.path.replace(
      vscode.workspace.getWorkspaceFolder(toVsCodeUri(uri))?.uri.path,
      ''
    );
    this.tooltip = undefined;
    this.command = {
      command: OPEN_COMMAND.command,
      title: OPEN_COMMAND.title,
      arguments: [
        {
          uri: uri,
        },
      ],
    };
    this.iconPath = new vscode.ThemeIcon(options.icon ?? 'new-file');
  }

  resolveTreeItem(): Promise<GroupedResourceTreeItem> {
    return Promise.resolve(this);
  }
}

export class ResourceTreeItem extends UriTreeItem {
  constructor(
    public readonly resource: Resource,
    private readonly workspace: FoamWorkspace,
    collapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(resource.uri, {
      title: resource.title,
      icon: 'note',
      collapsibleState,
    });
    this.contextValue = 'resource';
  }

  async resolveTreeItem(): Promise<ResourceTreeItem> {
    if (this instanceof ResourceTreeItem) {
      const content = await this.workspace.readAsMarkdown(this.resource.uri);
      this.tooltip = isSome(content)
        ? getNoteTooltip(content)
        : this.resource.title;
    }
    return this;
  }
}

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
}

const sortByTreeItemLabel = (a: vscode.TreeItem, b: vscode.TreeItem) =>
  a.label.toString().localeCompare(b.label.toString());

const sortByString = (a: string, b: string) =>
  a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());

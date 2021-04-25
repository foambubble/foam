import * as path from 'path';
import * as vscode from 'vscode';
import { URI, FoamWorkspace, Resource, FoamGraph } from 'foam-core';
import micromatch from 'micromatch';
import {
  GroupedResourcesConfig,
  GroupedResoucesConfigGroupBy,
} from '../settings';
import { getContainsTooltip, getNoteTooltip, isSome, isNone } from '../utils';
import { OPEN_COMMAND } from '../features/utility-commands';
import { toVsCodeUri } from './vsc-utils';

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
  private resources: Array<Resource | URI> = [];
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
   * @param {FoamGraph} graph
   * @param {Matcher} matcher
   * @param {string} providerId A **unique** providerId, this will be used to generate necessary commands within the provider.
   * @param {string} resourceName A display name used in the explorer view
   * @param {(resource: Resource, index: number) => boolean} filterPredicate A filter function called on each Resource within the workspace
   * @param {GroupedResourcesConfig} config
   * @param {URI[]} workspaceUris The workspace URIs
   * @memberof GroupedResourcesTreeDataProvider
   */
  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private providerId: string,
    private resourceName: string,
    private filterPredicate: (
      resource: URI,
      index: number,
      graph: FoamGraph,
      workspace: FoamWorkspace
    ) => boolean,
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
    if (
      this.groupBy === GroupedResoucesConfigGroupBy.Folder &&
      isNone(directory)
    ) {
      const directories = Object.entries(this.getGroupedResourcesByDirectory())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([dir, resources]) =>
            new DirectoryTreeItem(dir, resources, this.resourceName)
        );
      return Promise.resolve(directories);
    }

    const resources = isSome(directory) ? directory.resources : this.resources;

    const items = resources.map(item =>
      Resource.isResource(item)
        ? new ResourceTreeItem(item, this.workspace)
        : new UriTreeItem(item)
    );
    return Promise.resolve(items);
  }

  resolveTreeItem(
    item: GroupedResourceTreeItem
  ): Promise<GroupedResourceTreeItem> {
    return item.resolveTreeItem();
  }

  private computeResources(): void {
    this.resources = this.graph
      .getAllNodes()
      .filter((uri, index) =>
        this.filterPredicate(uri, index, this.graph, this.workspace)
      )
      .filter(uri => !this.isMatch(uri))
      .map(uri => (URI.isPlaceholder(uri) ? uri : this.workspace.find(uri)))
      .filter(isSome)
      .sort(this.sort);
  }

  private isMatch(uri: URI) {
    return micromatch.isMatch(URI.toFsPath(uri), this.exclude);
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
      const uri = Resource.isResource(resource) ? resource.uri : resource;
      const p = uri.path.replace(this.root, '');
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

  sort(a: URI | Resource, b: URI | Resource) {
    const titleA = Resource.isResource(a) ? a.title : URI.getBasename(a);
    const titleB = Resource.isResource(b) ? b.title : URI.getBasename(b);
    return titleA.toLocaleLowerCase().localeCompare(titleB.toLocaleLowerCase());
  }
}

type ResourceByDirectory = { [key: string]: Array<Resource | URI> };

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
    super(options?.title ?? URI.getBasename(uri), options.collapsibleState);
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
          resource: uri,
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
      icon: 'note', // TODO should use FoamResourceProvider
      collapsibleState,
    });
    this.contextValue = 'resource';
  }

  async resolveTreeItem(): Promise<ResourceTreeItem> {
    if (this instanceof ResourceTreeItem) {
      const content = await this.workspace.read(this.resource.uri);
      this.tooltip = isSome(content)
        ? getNoteTooltip(content) // TODO this should use the FoamResourceProvider
        : this.resource.title;
    }
    return this;
  }
}

export class DirectoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly dir: string,
    public readonly resources: Array<Resource | URI>,
    itemLabel: string
  ) {
    super(dir || 'Not Created', vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.resources.length > 1 ? 's' : '';
    this.description = `${this.resources.length} ${itemLabel}${s}`;
    const titles = this.resources.map(r =>
      Resource.isResource(r) ? r.title : URI.getBasename(r)
    );
    this.tooltip = getContainsTooltip(titles);
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';

  resolveTreeItem(): Promise<GroupedResourceTreeItem> {
    return Promise.resolve(this);
  }
}

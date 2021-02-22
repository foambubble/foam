import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  IDataStore,
  URI,
  FoamWorkspace,
  Resource,
  isAttachment,
  isPlaceholder,
  getTitle,
} from 'foam-core';
import micromatch from 'micromatch';
import {
  FilteredResourcesConfig,
  FilteredResourcesConfigGroupBy,
} from '../settings';
import { getContainsTooltip, getNoteTooltip } from '../utils';
import { dirname, join } from 'path';
import { FoamFeature } from '../types';
import { commands } from 'vscode';

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.open-placeholder-note',
        async (uri: vscode.Uri) => {
          let dir: string;

          if (vscode.workspace.workspaceFolders) {
            dir = vscode.workspace.workspaceFolders[0].uri.fsPath.toString();
          }

          if (!dir) {
            const activeFile = vscode.window.activeTextEditor?.document;
            dir = activeFile ? dirname(activeFile.uri.fsPath) : null;
          }

          if (dir) {
            const path = join(dir, `${uri.path}.md`);
            await fs.promises.writeFile(path, `# ${uri.path}`);
            const ur = vscode.Uri.file(path);
            await vscode.window.showTextDocument(ur, {
              preserveFocus: false,
              preview: false,
            });
          }
        }
      )
    );
  },
};

export default feature;

export class FilteredResourcesProvider
  implements vscode.TreeDataProvider<FilteredResourceTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<FilteredResourceTreeItem | undefined | void> = new vscode.EventEmitter<FilteredResourceTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<FilteredResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;
  // prettier-ignore
  private groupBy: FilteredResourcesConfigGroupBy = FilteredResourcesConfigGroupBy.Folder;
  private exclude: string[] = [];
  private filteredResources: Resource[] = [];
  private root = vscode.workspace.workspaceFolders[0].uri.path;

  constructor(
    private workspace: FoamWorkspace,
    private dataStore: IDataStore,
    private filteredNoteType: string,
    private filteredNoteContextValue: string,
    private filterPredicate: (resource: Resource, index: number) => boolean,
    config: FilteredResourcesProviderConfig
  ) {
    this.groupBy = config.groupBy;
    this.exclude = this.getGlobs(config.workspacesFsPaths, config.exclude);
    this.setContext();
    this.computeFilteredResources();
  }

  setGroupBy(groupBy: FilteredResourcesConfigGroupBy): void {
    this.groupBy = groupBy;
    this.setContext();
    this.refresh();
  }

  private setContext(): void {
    vscode.commands.executeCommand(
      'setContext',
      `foam-vscode.${this.filteredNoteType}-grouped-by-folder`,
      this.groupBy === FilteredResourcesConfigGroupBy.Folder
    );
  }

  refresh(): void {
    this.computeFilteredResources();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: FilteredResourceTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(directory?: Directory): Thenable<FilteredResourceTreeItem[]> {
    if (!directory && this.groupBy === FilteredResourcesConfigGroupBy.Folder) {
      const directories = Object.entries(this.getFilteredResourcesByDirectory())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([dir, filteredResources]) =>
            new Directory(dir, filteredResources, this.filteredNoteContextValue)
        );
      return Promise.resolve(directories);
    }

    if (directory) {
      const filteredResources = directory.resources.map(
        o => new FilteredResource(o, this.filteredNoteContextValue)
      );
      return Promise.resolve(filteredResources);
    }

    const filteredResources = this.filteredResources.map(
      o => new FilteredResource(o, this.filteredNoteContextValue)
    );
    return Promise.resolve(filteredResources);
  }

  async resolveTreeItem(
    item: FilteredResourceTreeItem
  ): Promise<FilteredResourceTreeItem> {
    if (item instanceof FilteredResource) {
      const content = await this.dataStore.read(item.resource.uri);
      item.tooltip = getNoteTooltip(content);
    }
    return item;
  }

  private computeFilteredResources(): void {
    this.filteredResources = this.workspace
      .list()
      .filter(this.filterPredicate)
      .filter(resource => !this.isMatch(resource.uri))
      .sort(this.sort);
  }

  private isMatch(uri: URI) {
    return micromatch.isMatch(uri.fsPath, this.exclude);
  }

  private getGlobs(fsPaths: string[], globs: string[]): string[] {
    globs = globs.map(glob => (glob.startsWith('/') ? glob.slice(1) : glob));

    const exclude: string[] = [];

    for (const fsPath of fsPaths) {
      let folder = fsPath.replace(/\\/g, '/');
      if (folder.substr(-1) === '/') {
        folder = folder.slice(0, -1);
      }
      exclude.push(...globs.map(g => `${folder}/${g}`));
    }

    return exclude;
  }

  private getFilteredResourcesByDirectory(): FilteredResourcesByDirectory {
    const filtered: FilteredResourcesByDirectory = {};
    for (const resource of this.filteredResources) {
      const p = resource.uri.path.replace(this.root, '');
      const { dir } = path.parse(p);

      if (filtered[dir]) {
        filtered[dir].push(resource);
      } else {
        filtered[dir] = [resource];
      }
    }

    for (const k in filtered) {
      filtered[k].sort(this.sort);
    }

    return filtered;
  }

  private sort(a: Resource, b: Resource) {
    const titleA = getTitle(a);
    const titleB = getTitle(b);
    return titleA.localeCompare(titleB);
  }
}

export interface FilteredResourcesProviderConfig
  extends FilteredResourcesConfig {
  workspacesFsPaths: string[];
  includeLinks?: boolean;
}

type FilteredResourcesByDirectory = { [key: string]: Resource[] };

type FilteredResourceTreeItem = FilteredResource | Directory;

class FilteredResource extends vscode.TreeItem {
  constructor(public readonly resource: Resource, contextValue: string) {
    super(getTitle(resource), vscode.TreeItemCollapsibleState.None);
    this.description = resource.uri.path;
    this.tooltip = undefined;
    if (isPlaceholder(resource)) {
      this.command = {
        command: 'foam-vscode.open-placeholder-note',
        title: 'Foam: Open Placeholder Note',
        arguments: [resource.uri],
      };
    } else {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [resource.uri],
      };
    }
    this.contextValue = contextValue;

    let iconStr: string;
    if (isAttachment(this.resource)) {
      iconStr = 'file-media';
    } else if (isPlaceholder(this.resource)) {
      iconStr = 'new-file';
    } else {
      iconStr = 'note';
    }
    this.iconPath = new vscode.ThemeIcon(iconStr);
  }
}

export class Directory extends vscode.TreeItem {
  constructor(
    public readonly dir: string,
    public readonly resources: Resource[],
    contextValue: string
  ) {
    super(dir || 'Not Created', vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.resources.length > 1 ? 's' : '';
    this.description = `${this.resources.length} ${contextValue}${s}`;
    const titles = this.resources.map(getTitle);
    this.tooltip = getContainsTooltip(titles);
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';
}

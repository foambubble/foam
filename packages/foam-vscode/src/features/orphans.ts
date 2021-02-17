import * as path from 'path';
import * as vscode from 'vscode';
import { Foam, IDataStore, Note, URI, FoamWorkspace } from 'foam-core';
import micromatch from 'micromatch';
import {
  getOrphansConfig,
  OrphansConfig,
  OrphansConfigGroupBy,
} from '../settings';
import { FoamFeature } from '../types';
import { getNoteTooltip, getContainsTooltip, isNote } from '../utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesFsPaths = vscode.workspace.workspaceFolders.map(
      dir => dir.uri.fsPath
    );
    const provider = new OrphansProvider(
      foam.workspace,
      foam.services.dataStore,
      {
        ...getOrphansConfig(),
        workspacesFsPaths,
      }
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
      vscode.commands.registerCommand(
        'foam-vscode.group-orphans-by-folder',
        () => provider.setGroupBy(OrphansConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand('foam-vscode.group-orphans-off', () =>
        provider.setGroupBy(OrphansConfigGroupBy.Off)
      ),
      foam.workspace.onDidAdd(() => provider.refresh()),
      foam.workspace.onDidUpdate(() => provider.refresh()),
      foam.workspace.onDidDelete(() => provider.refresh())
    );
  },
};

export default feature;

export class OrphansProvider
  implements vscode.TreeDataProvider<OrphanTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<OrphanTreeItem | undefined | void> = new vscode.EventEmitter<OrphanTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<OrphanTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private groupBy: OrphansConfigGroupBy = OrphansConfigGroupBy.Folder;
  private exclude: string[] = [];
  private orphans: Note[] = [];
  private root = vscode.workspace.workspaceFolders[0].uri.path;

  constructor(
    private workspace: FoamWorkspace,
    private dataStore: IDataStore,
    config: OrphansProviderConfig
  ) {
    this.groupBy = config.groupBy;
    this.exclude = this.getGlobs(config.workspacesFsPaths, config.exclude);
    this.setContext();
    this.computeOrphans();
  }

  setGroupBy(groupBy: OrphansConfigGroupBy): void {
    this.groupBy = groupBy;
    this.setContext();
    this.refresh();
  }

  private setContext(): void {
    vscode.commands.executeCommand(
      'setContext',
      'foam-vscode.orphans-grouped-by-folder',
      this.groupBy === OrphansConfigGroupBy.Folder
    );
  }

  refresh(): void {
    this.computeOrphans();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: OrphanTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(directory?: Directory): Thenable<OrphanTreeItem[]> {
    if (!directory && this.groupBy === OrphansConfigGroupBy.Folder) {
      const directories = Object.entries(this.getOrphansByDirectory())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dir, orphans]) => new Directory(dir, orphans));
      return Promise.resolve(directories);
    }

    if (directory) {
      const orphans = directory.notes.map(o => new Orphan(o));
      return Promise.resolve(orphans);
    }

    const orphans = this.orphans.map(o => new Orphan(o));
    return Promise.resolve(orphans);
  }

  async resolveTreeItem(item: OrphanTreeItem): Promise<OrphanTreeItem> {
    if (item instanceof Orphan) {
      const content = await this.dataStore.read(item.note.uri);
      item.tooltip = getNoteTooltip(content);
    }
    return item;
  }

  private computeOrphans(): void {
    this.orphans = this.workspace
      .list()
      .filter(isNote)
      .filter(note => this.workspace.getConnections(note.uri).length === 0)
      .filter(note => !this.isMatch(note.uri))
      .sort((a, b) => a.title.localeCompare(b.title));
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

  private getOrphansByDirectory(): OrphansByDirectory {
    const orphans: OrphansByDirectory = {};
    for (const orphan of this.orphans) {
      const p = orphan.uri.path.replace(this.root, '');
      const { dir } = path.parse(p);

      if (orphans[dir]) {
        orphans[dir].push(orphan);
      } else {
        orphans[dir] = [orphan];
      }
    }

    for (const k in orphans) {
      orphans[k].sort((a, b) => a.title.localeCompare(b.title));
    }

    return orphans;
  }
}

export interface OrphansProviderConfig extends OrphansConfig {
  workspacesFsPaths: string[];
}

type OrphansByDirectory = { [key: string]: Note[] };

type OrphanTreeItem = Orphan | Directory;

class Orphan extends vscode.TreeItem {
  constructor(public readonly note: Note) {
    super(note.title, vscode.TreeItemCollapsibleState.None);
    this.description = note.uri.path;
    this.tooltip = undefined;
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [note.uri],
    };
  }

  iconPath = new vscode.ThemeIcon('note');
  contextValue = 'orphan';
}

export class Directory extends vscode.TreeItem {
  constructor(public readonly dir: string, public readonly notes: Note[]) {
    super(dir, vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.notes.length > 1 ? 's' : '';
    this.description = `${this.notes.length} orphan${s}`;
    const titles = this.notes.map(n => n.title);
    this.tooltip = getContainsTooltip(titles);
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';
}

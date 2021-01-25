import * as path from 'path';
import * as vscode from 'vscode';
import { Foam, Note } from 'foam-core';
import micromatch from 'micromatch';
import {
  getOrphansConfig,
  OrphansConfig,
  OrphansConfigGroupBy,
} from '../settings';
import { FoamFeature } from '../types';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const config = getOrphansConfig();
    const provider = new OrphansProvider(foam, config);

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
      vscode.commands.registerCommand(
        'foam-vscode.group-orphans-by-folder',
        () => provider.setGroupBy(OrphansConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand('foam-vscode.group-orphans-off', () =>
        provider.setGroupBy(OrphansConfigGroupBy.Off)
      ),
      foam.notes.onDidUpdateNote(() => provider.refresh())
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

  private orphans: Note[] = [];
  private exclude: string[] = [];
  private groupBy: OrphansConfigGroupBy = OrphansConfigGroupBy.Folder;
  private root = vscode.workspace.workspaceFolders[0].uri.fsPath;

  constructor(private foam: Foam, config: OrphansConfig) {
    this.exclude = config.exclude.map(d => path.normalize(`/${d}`));
    this.groupBy = config.groupBy;
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

  private computeOrphans(): void {
    this.orphans = this.foam.notes
      .getNotes()
      .filter(note => !this.foam.notes.getAllLinks(note.uri).length)
      .filter(note => {
        const p = note.uri.fsPath.replace(this.root, '');
        const { dir } = path.parse(p);
        return !micromatch.isMatch(dir, this.exclude);
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  private getOrphansByDirectory(): OrphansByDirectory {
    const orphans: OrphansByDirectory = {};
    for (const orphan of this.orphans) {
      const p = orphan.uri.fsPath.replace(this.root, '');
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

type OrphansByDirectory = { [key: string]: Note[] };

type OrphanTreeItem = Orphan | Directory;

class Orphan extends vscode.TreeItem {
  constructor(public readonly note: Note) {
    super(note.title, vscode.TreeItemCollapsibleState.None);
    this.description = note.uri.path;
    this.tooltip = this.description;
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
    this.tooltip = this.description;
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';
}
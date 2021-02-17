import * as path from 'path';
import * as vscode from 'vscode';
import { Foam, IDataStore, Note, URI } from 'foam-core';
import micromatch from 'micromatch';
import {
  getBlankNotesConfig,
  BlankNotesConfig,
  BlankNotesConfigGroupBy,
} from '../settings';
import { FoamFeature } from '../types';
import { getNoteTooltip, getContainsTooltip } from '../utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesFsPaths = vscode.workspace.workspaceFolders.map(
      dir => dir.uri.fsPath
    );
    const provider = new BlankNotesProvider(foam, foam.services.dataStore, {
      ...getBlankNotesConfig(),
      workspacesFsPaths,
    });

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.blank-notes',
        provider
      ),
      vscode.commands.registerCommand(
        'foam-vscode.group-blank-notes-by-folder',
        () => provider.setGroupBy(BlankNotesConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand('foam-vscode.group-blank-notes-off', () =>
        provider.setGroupBy(BlankNotesConfigGroupBy.Off)
      ),
      foam.notes.onDidAddNote(() => provider.refresh()),
      foam.notes.onDidUpdateNote(() => provider.refresh()),
      foam.notes.onDidDeleteNote(() => provider.refresh())
    );
  },
};

export default feature;

export class BlankNotesProvider
  implements vscode.TreeDataProvider<BlankNotesTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<BlankNotesTreeItem | undefined | void> = new vscode.EventEmitter<BlankNotesTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<BlankNotesTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private groupBy: BlankNotesConfigGroupBy = BlankNotesConfigGroupBy.Folder;
  private exclude: string[] = [];
  private blankNotes: Note[] = [];
  private root = vscode.workspace.workspaceFolders[0].uri.fsPath;

  constructor(
    private foam: Foam,
    private dataStore: IDataStore,
    config: BlankNotesProviderConfig
  ) {
    this.groupBy = config.groupBy;
    this.exclude = this.getGlobs(config.workspacesFsPaths, config.exclude);
    this.setContext();
    this.computeBlankNotes();
  }

  setGroupBy(groupBy: BlankNotesConfigGroupBy): void {
    this.groupBy = groupBy;
    this.setContext();
    this.refresh();
  }

  private setContext(): void {
    vscode.commands.executeCommand(
      'setContext',
      'foam-vscode.blank-notes-grouped-by-folder',
      this.groupBy === BlankNotesConfigGroupBy.Folder
    );
  }

  refresh(): void {
    this.computeBlankNotes();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: BlankNotesTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(directory?: Directory): Thenable<BlankNotesTreeItem[]> {
    if (!directory && this.groupBy === BlankNotesConfigGroupBy.Folder) {
      const directories = Object.entries(this.getBlankNotesByDirectory())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dir, blankNotes]) => new Directory(dir, blankNotes));
      return Promise.resolve(directories);
    }

    if (directory) {
      const blankNotes = directory.notes.map(o => new BlankNote(o));
      return Promise.resolve(blankNotes);
    }

    const blankNotes = this.blankNotes.map(o => new BlankNote(o));
    return Promise.resolve(blankNotes);
  }

  async resolveTreeItem(item: BlankNotesTreeItem): Promise<BlankNotesTreeItem> {
    if (item instanceof BlankNote) {
      const content = await this.dataStore.read(item.note.uri);
      item.tooltip = getNoteTooltip(content);
    }
    return item;
  }

  private computeBlankNotes(): void {
    this.blankNotes = this.foam.notes
      .getNotes()
      .filter(note => this.isBlank(note))
      .filter(note => !this.isMatch(note.uri))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  private isBlank(note: Note) {
    return note.source.text.trim().split('\n').length === 1;
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

  private getBlankNotesByDirectory(): BlankNotesByDirectory {
    const blankNotes: BlankNotesByDirectory = {};
    for (const blankNote of this.blankNotes) {
      const p = blankNote.uri.fsPath.replace(this.root, '');
      const { dir } = path.parse(p);

      if (blankNotes[dir]) {
        blankNotes[dir].push(blankNote);
      } else {
        blankNotes[dir] = [blankNote];
      }
    }

    for (const k in blankNotes) {
      blankNotes[k].sort((a, b) => a.title.localeCompare(b.title));
    }

    return blankNotes;
  }
}

export interface BlankNotesProviderConfig extends BlankNotesConfig {
  workspacesFsPaths: string[];
}

type BlankNotesByDirectory = { [key: string]: Note[] };

type BlankNotesTreeItem = BlankNote | Directory;

class BlankNote extends vscode.TreeItem {
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
  contextValue = 'blankNote';
}

export class Directory extends vscode.TreeItem {
  constructor(public readonly dir: string, public readonly notes: Note[]) {
    super(dir, vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.notes.length > 1 ? 's' : '';
    this.description = `${this.notes.length} blankNote${s}`;
    const titles = this.notes.map(n => n.title);
    this.tooltip = getContainsTooltip(titles);
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';
}

import * as path from 'path';
import * as vscode from 'vscode';
import { IDataStore, Note, URI, FoamWorkspace } from 'foam-core';
import micromatch from 'micromatch';
import { FilteredNotesConfig, FilteredNotesConfigGroupBy } from '../settings';
import { getNoteTooltip, getContainsTooltip, isNote } from '../utils';

export class FilteredNotesProvider
  implements vscode.TreeDataProvider<FilteredNoteTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<FilteredNoteTreeItem | undefined | void> = new vscode.EventEmitter<FilteredNoteTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<FilteredNoteTreeItem | undefined | void> = this._onDidChangeTreeData.event;
  // prettier-ignore
  private groupBy: FilteredNotesConfigGroupBy = FilteredNotesConfigGroupBy.Folder;
  private exclude: string[] = [];
  private filteredNotes: Note[] = [];
  private root = vscode.workspace.workspaceFolders[0].uri.path;

  constructor(
    private workspace: FoamWorkspace,
    private dataStore: IDataStore,
    private filteredNoteType: string,
    private filteredNoteContextValue: string,
    private noteFilterPredicate: (note: Note, index: number) => boolean,
    config: FilteredNotesProviderConfig
  ) {
    this.groupBy = config.groupBy;
    this.exclude = this.getGlobs(config.workspacesFsPaths, config.exclude);
    this.setContext();
    this.computeFilteredNotes();
  }

  setGroupBy(groupBy: FilteredNotesConfigGroupBy): void {
    this.groupBy = groupBy;
    this.setContext();
    this.refresh();
  }

  private setContext(): void {
    vscode.commands.executeCommand(
      'setContext',
      `foam-vscode.${this.filteredNoteType}-grouped-by-folder`,
      this.groupBy === FilteredNotesConfigGroupBy.Folder
    );
  }

  refresh(): void {
    this.computeFilteredNotes();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: FilteredNoteTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(directory?: Directory): Thenable<FilteredNoteTreeItem[]> {
    if (!directory && this.groupBy === FilteredNotesConfigGroupBy.Folder) {
      const directories = Object.entries(this.getFilteredNotesByDirectory())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([dir, filteredNotes]) =>
            new Directory(dir, filteredNotes, this.filteredNoteContextValue)
        );
      return Promise.resolve(directories);
    }

    if (directory) {
      const filteredNotes = directory.notes.map(
        o => new FilteredNote(o, this.filteredNoteContextValue)
      );
      return Promise.resolve(filteredNotes);
    }

    const filteredNotes = this.filteredNotes.map(
      o => new FilteredNote(o, this.filteredNoteContextValue)
    );
    return Promise.resolve(filteredNotes);
  }

  async resolveTreeItem(
    item: FilteredNoteTreeItem
  ): Promise<FilteredNoteTreeItem> {
    if (item instanceof FilteredNote) {
      const content = await this.dataStore.read(item.note.uri);
      item.tooltip = getNoteTooltip(content);
    }
    return item;
  }

  private computeFilteredNotes(): void {
    this.filteredNotes = this.workspace
      .list()
      .filter(isNote)
      .filter(this.noteFilterPredicate)
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

  private getFilteredNotesByDirectory(): FilteredNotesByDirectory {
    const filteredNotes: FilteredNotesByDirectory = {};
    for (const filteredNote of this.filteredNotes) {
      const p = filteredNote.uri.path.replace(this.root, '');
      const { dir } = path.parse(p);

      if (filteredNotes[dir]) {
        filteredNotes[dir].push(filteredNote);
      } else {
        filteredNotes[dir] = [filteredNote];
      }
    }

    for (const k in filteredNotes) {
      filteredNotes[k].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filteredNotes;
  }
}

export interface FilteredNotesProviderConfig extends FilteredNotesConfig {
  workspacesFsPaths: string[];
}

type FilteredNotesByDirectory = { [key: string]: Note[] };

type FilteredNoteTreeItem = FilteredNote | Directory;

class FilteredNote extends vscode.TreeItem {
  constructor(public readonly note: Note, contextValue: string) {
    super(note.title, vscode.TreeItemCollapsibleState.None);
    this.description = note.uri.path;
    this.tooltip = undefined;
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [note.uri],
    };
    this.contextValue = contextValue;
  }

  iconPath = new vscode.ThemeIcon('note');
}

export class Directory extends vscode.TreeItem {
  constructor(
    public readonly dir: string,
    public readonly notes: Note[],
    contextValue
  ) {
    super(dir, vscode.TreeItemCollapsibleState.Collapsed);
    const s = this.notes.length > 1 ? 's' : '';
    this.description = `${this.notes.length} ${contextValue}${s}`;
    const titles = this.notes.map(n => n.title);
    this.tooltip = getContainsTooltip(titles);
  }

  iconPath = new vscode.ThemeIcon('folder');
  contextValue = 'directory';
}

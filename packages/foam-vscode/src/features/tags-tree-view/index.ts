import * as vscode from 'vscode';
import { Foam, Note, IDataStore } from 'foam-core';
import { FoamFeature } from '../../types';
import { getNoteTooltip, getContainsTooltip } from '../../utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const provider = new TagsProvider(foam, foam.services.dataStore);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.tags-explorer',
        provider
      )
    );
    foam.notes.onDidUpdateNote(() => provider.refresh());
  },
};

export default feature;

export class TagsProvider implements vscode.TreeDataProvider<TagTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<TagTreeItem | undefined | void> = new vscode.EventEmitter<TagTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<TagTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private tags: {
    tag: string;
    notes: TagMetadata[];
  }[];

  constructor(private foam: Foam, private dataStore: IDataStore) {
    this.computeTags();
  }

  refresh(): void {
    this.computeTags();
    this._onDidChangeTreeData.fire();
  }

  private computeTags() {
    const rawTags: {
      [key: string]: TagMetadata[];
    } = this.foam.notes
      .getNotes()
      .reduce((acc: { [key: string]: TagMetadata[] }, note) => {
        note.tags.forEach(tag => {
          acc[tag] = acc[tag] ?? [];
          acc[tag].push({ title: note.title, uri: note.uri });
        });
        return acc;
      }, {});
    this.tags = Object.entries(rawTags)
      .map(([tag, notes]) => ({ tag, notes }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  getTreeItem(element: TagTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Tag): Thenable<TagTreeItem[]> {
    if (element) {
      const references: TagReference[] = element.notes.map(({ uri }) => {
        const note = this.foam.notes.getNote(uri);
        return new TagReference(element.tag, note);
      });
      return Promise.resolve([
        new TagSearch(element.tag),
        ...references.sort((a, b) => a.title.localeCompare(b.title)),
      ]);
    }
    if (!element) {
      const tags: Tag[] = this.tags.map(
        ({ tag, notes }) => new Tag(tag, notes)
      );
      return Promise.resolve(tags.sort((a, b) => a.tag.localeCompare(b.tag)));
    }
  }

  async resolveTreeItem(item: TagTreeItem): Promise<TagTreeItem> {
    if (item instanceof TagReference) {
      const content = await this.dataStore.read(item.note.uri);
      item.tooltip = getNoteTooltip(content);
    }
    return item;
  }
}

type TagTreeItem = Tag | TagReference | TagSearch;

type TagMetadata = { title: string; uri: vscode.Uri };

export class Tag extends vscode.TreeItem {
  constructor(
    public readonly tag: string,
    public readonly notes: TagMetadata[]
  ) {
    super(tag, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${this.notes.length} reference${
      this.notes.length !== 1 ? 's' : ''
    }`;
    this.tooltip = getContainsTooltip(this.notes.map(n => n.title));
  }

  iconPath = new vscode.ThemeIcon('symbol-number');
  contextValue = 'tag';
}

export class TagSearch extends vscode.TreeItem {
  constructor(public readonly tag: string) {
    super(`Search #${tag}`, vscode.TreeItemCollapsibleState.None);
    const searchString = `#${tag}`;
    this.tooltip = `Search ${searchString} in workspace`;
    this.command = {
      command: 'workbench.action.findInFiles',
      arguments: [
        {
          query: searchString,
          triggerSearch: true,
          matchWholeWord: true,
          isCaseSensitive: true,
        },
      ],
      title: 'Search',
    };
  }

  iconPath = new vscode.ThemeIcon('search');
  contextValue = 'tag-search';
}

export class TagReference extends vscode.TreeItem {
  public readonly title: string;
  constructor(public readonly tag: string, public readonly note: Note) {
    super(note.title, vscode.TreeItemCollapsibleState.None);
    this.title = note.title;
    this.description = note.uri.path;
    this.tooltip = undefined;
    const resourceUri = note.uri;
    let selection: vscode.Range | null = null;
    // TODO move search fn to core
    const lines = note.source.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const found = lines[i].indexOf(`#${tag}`);
      if (found >= 0) {
        selection = new vscode.Range(i, found, i, found + `#${tag}`.length);
        break;
      }
    }
    this.command = {
      command: 'vscode.open',
      arguments: [
        resourceUri,
        {
          preview: true,
          selection: selection,
        },
      ],
      title: 'Open File',
    };
  }

  iconPath = new vscode.ThemeIcon('note');
  contextValue = 'reference';
}

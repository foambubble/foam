import * as vscode from 'vscode';
import { Foam, Resource, URI, FoamWorkspace } from 'foam-core';
import { FoamFeature } from '../../types';
import {
  getNoteTooltip,
  getContainsTooltip,
  isSome,
  isNone,
} from '../../utils';

const TAG_SEPARATOR = '/';
const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const provider = new TagsProvider(foam, foam.workspace);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.tags-explorer',
        provider
      )
    );
    foam.workspace.onDidUpdate(() => provider.refresh());
    foam.workspace.onDidAdd(() => provider.refresh());
    foam.workspace.onDidDelete(() => provider.refresh());
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

  constructor(private foam: Foam, private workspace: FoamWorkspace) {
    this.computeTags();
  }

  refresh(): void {
    this.computeTags();
    this._onDidChangeTreeData.fire();
  }

  private computeTags() {
    const rawTags: {
      [key: string]: TagMetadata[];
    } = this.foam.workspace
      .list()
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
      const nestedTagItems: TagTreeItem[] = this.tags
        .filter(item => item.tag.indexOf(element.title + TAG_SEPARATOR) > -1)
        .map(
          item =>
            new Tag(
              item.tag,
              item.tag.substring(item.tag.indexOf(TAG_SEPARATOR) + 1),
              item.notes
            )
        )
        .sort((a, b) => a.title.localeCompare(b.title));

      const references: TagTreeItem[] = element.notes
        .map(({ uri }) => this.foam.workspace.get(uri))
        .filter(note => note.tags.has(element.tag))
        .map(note => new TagReference(element.tag, note))
        .sort((a, b) => a.title.localeCompare(b.title));

      return Promise.resolve([
        new TagSearch(element.title),
        ...nestedTagItems,
        ...references,
      ]);
    }
    if (!element) {
      const tags: Tag[] = this.tags
        .map(({ tag, notes }) => {
          const parentTag =
            tag.indexOf(TAG_SEPARATOR) > 0
              ? tag.substring(0, tag.indexOf(TAG_SEPARATOR))
              : tag;

          return new Tag(parentTag, parentTag, notes);
        })
        .filter(
          (value, index, array) =>
            array.findIndex(tag => tag.title === value.title) === index
        );

      return Promise.resolve(tags.sort((a, b) => a.tag.localeCompare(b.tag)));
    }
  }

  async resolveTreeItem(item: TagTreeItem): Promise<TagTreeItem> {
    if (item instanceof TagReference) {
      const content = await this.workspace.read(item.note.uri);
      if (isSome(content)) {
        item.tooltip = getNoteTooltip(content);
      }
    }
    return item;
  }
}

type TagTreeItem = Tag | TagReference | TagSearch;

type TagMetadata = { title: string; uri: URI };

export class Tag extends vscode.TreeItem {
  constructor(
    public readonly tag: string,
    public readonly title: string,
    public readonly notes: TagMetadata[]
  ) {
    super(title, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${this.notes.length} reference${
      this.notes.length !== 1 ? 's' : ''
    }`;
    this.tooltip = getContainsTooltip(this.notes.map(n => n.title));
  }

  iconPath = new vscode.ThemeIcon('symbol-number');
  contextValue = 'tag';
}

export class TagSearch extends vscode.TreeItem {
  public readonly title: string;
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
  constructor(public readonly tag: string, public readonly note: Resource) {
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

import { URI } from '../core/model/uri';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { getNoteTooltip, isSome } from '../utils';
import { toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Resource, Tag } from '../core/model/note';

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
    foam.tags.onDidUpdate(() => provider.refresh());
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
    notes: URI[];
  }[];

  constructor(private foam: Foam, private workspace: FoamWorkspace) {
    this.computeTags();
  }

  refresh(): void {
    this.computeTags();
    this._onDidChangeTreeData.fire();
  }

  private computeTags() {
    this.tags = [...this.foam.tags.tags]
      .map(([tag, notes]) => ({ tag, notes }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  getTreeItem(element: TagTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TagItem): Thenable<TagTreeItem[]> {
    if (element) {
      const nestedTagItems: TagTreeItem[] = this.tags
        .filter(item => item.tag.indexOf(element.title + TAG_SEPARATOR) > -1)
        .map(
          item =>
            new TagItem(
              item.tag,
              item.tag.substring(item.tag.indexOf(TAG_SEPARATOR) + 1),
              item.notes
            )
        )
        .sort((a, b) => a.title.localeCompare(b.title));

      const references: TagTreeItem[] = element.notes
        .map(uri => this.foam.workspace.get(uri))
        .reduce((acc, note) => {
          const tags = note.tags.filter(t => t.label === element.tag);
          return [
            ...acc,
            ...tags.slice(0, 1).map(t => new TagReference(t, note)),
          ];
        }, [])
        .sort((a, b) => a.title.localeCompare(b.title));

      return Promise.resolve([
        new TagSearch(element.tag),
        ...nestedTagItems,
        ...references,
      ]);
    }
    if (!element) {
      const tags: TagItem[] = this.tags
        .map(({ tag, notes }) => {
          const parentTag =
            tag.indexOf(TAG_SEPARATOR) > 0
              ? tag.substring(0, tag.indexOf(TAG_SEPARATOR))
              : tag;

          return new TagItem(parentTag, parentTag, notes);
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

type TagTreeItem = TagItem | TagReference | TagSearch;

export class TagItem extends vscode.TreeItem {
  constructor(
    public readonly tag: string,
    public readonly title: string,
    public readonly notes: URI[]
  ) {
    super(title, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${this.notes.length} reference${
      this.notes.length !== 1 ? 's' : ''
    }`;
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
  constructor(public readonly tag: Tag, public readonly note: Resource) {
    super(note.title, vscode.TreeItemCollapsibleState.None);
    const uri = toVsCodeUri(note.uri);
    this.title = note.title;
    this.description = vscode.workspace.asRelativePath(uri);
    this.tooltip = undefined;
    this.command = {
      command: 'vscode.open',
      arguments: [
        uri,
        {
          preview: true,
          selection: toVsCodeRange(tag.range),
        },
      ],
      title: 'Open File',
    };
  }

  iconPath = new vscode.ThemeIcon('note');
  contextValue = 'reference';
}

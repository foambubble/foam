import { URI } from '../../core/model/uri';
import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamTags } from '../../core/model/tags';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  groupRangesByResource,
} from '../../utils/tree-view-utils';

const TAG_SEPARATOR = '/';
export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  const provider = new TagsProvider(foam.tags, foam.workspace);
  const treeView = vscode.window.createTreeView('foam-vscode.tags-explorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  const baseTitle = treeView.title;
  treeView.title = baseTitle + ` (${foam.tags.tags.size})`;

  context.subscriptions.push(
    treeView,
    foam.tags.onDidUpdate(() => {
      provider.refresh();
      treeView.title = baseTitle + ` (${foam.tags.tags.size})`;
    })
  );
}

export class TagsProvider implements vscode.TreeDataProvider<TagTreeItem> {
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<
    TagTreeItem | undefined | void
  > = new vscode.EventEmitter<TagTreeItem | undefined | void>();
  // prettier-ignore
  readonly onDidChangeTreeData: vscode.Event<TagTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private tags: {
    tag: string;
    notes: URI[];
  }[];

  private foamTags: FoamTags;

  constructor(tags: FoamTags, private workspace: FoamWorkspace) {
    this.foamTags = tags;
    this.computeTags();
  }

  refresh(): void {
    this.computeTags();
    this._onDidChangeTreeData.fire();
  }

  private computeTags() {
    this.tags = [...this.foamTags.tags]
      .map(([tag, notes]) => ({ tag, notes }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  getTreeItem(element: TagTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TagItem): Promise<TagTreeItem[]> {
    if ((element as any)?.getChildren) {
      const children = await (element as any).getChildren();
      return children;
    }
    const parentTag = element ? element.tag : '';
    const parentPrefix = element ? parentTag + TAG_SEPARATOR : '';

    const tagsAtThisLevel = this.tags
      .filter(({ tag }) => tag.startsWith(parentPrefix))
      .map(({ tag }) => {
        const nextSeparator = tag.indexOf(TAG_SEPARATOR, parentPrefix.length);
        const label =
          nextSeparator > -1
            ? tag.substring(parentPrefix.length, nextSeparator)
            : tag.substring(parentPrefix.length);
        const tagId = parentPrefix + label;
        return { label, tagId, tag };
      })
      .reduce((acc, { label, tagId, tag }) => {
        const existing = acc.has(label);
        const nResources = this.foamTags.tags.get(tag).length ?? 0;
        if (!existing) {
          acc.set(label, { label, tagId, nResources: 0 });
        }
        acc.get(label).nResources += nResources;
        return acc;
      }, new Map() as Map<string, { label: string; tagId: string; nResources: number }>);

    const subtags = Array.from(tagsAtThisLevel.values())
      .map(({ label, tagId, nResources }) => {
        const resources = this.foamTags.tags.get(tagId) ?? [];
        return new TagItem(tagId, label, nResources, resources);
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    const resourceTags: ResourceRangeTreeItem[] = (element?.notes ?? [])
      .map(uri => this.workspace.get(uri))
      .reduce((acc, note) => {
        const tags = note.tags.filter(t => t.label === element.tag);
        const items = tags.map(t =>
          ResourceRangeTreeItem.createStandardItem(
            this.workspace,
            note,
            t.range,
            'tag'
          )
        );
        return [...acc, ...items];
      }, []);

    const resources = await groupRangesByResource(this.workspace, resourceTags);

    return Promise.resolve(
      [element && new TagSearch(element.tag), ...subtags, ...resources].filter(
        Boolean
      )
    );
  }

  async resolveTreeItem(item: TagTreeItem): Promise<TagTreeItem> {
    if (
      item instanceof ResourceTreeItem ||
      item instanceof ResourceRangeTreeItem
    ) {
      return item.resolveTreeItem();
    }
    return Promise.resolve(item);
  }
}

type TagTreeItem =
  | TagItem
  | TagSearch
  | ResourceTreeItem
  | ResourceRangeTreeItem;

export class TagItem extends vscode.TreeItem {
  constructor(
    public readonly tag: string,
    public readonly title: string,
    public readonly nResourcesInSubtree: number,
    public readonly notes: URI[]
  ) {
    super(title, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${nResourcesInSubtree} reference${
      nResourcesInSubtree !== 1 ? 's' : ''
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

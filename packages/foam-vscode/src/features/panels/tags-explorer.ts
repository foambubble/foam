import { URI } from '../../core/model/uri';
import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamTags } from '../../core/model/tags';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  groupRangesByResource,
} from './utils/tree-view-utils';
import {
  Folder,
  FolderTreeItem,
  FolderTreeProvider,
  walk,
} from './utils/folder-tree-provider';

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
  provider.refresh();
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

export class TagsProvider extends FolderTreeProvider<TagTreeItem, string> {
  private tags: {
    tag: string;
    notes: URI[];
  }[];

  constructor(private foamTags: FoamTags, private workspace: FoamWorkspace) {
    super();
  }

  refresh(): void {
    this.tags = [...this.foamTags.tags]
      .map(([tag, notes]) => ({ tag, notes }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
    super.refresh();
  }

  getValues(): string[] {
    return Array.from(this.tags.values()).map(tag => tag.tag);
  }

  valueToPath(value: string) {
    return value.split(TAG_SEPARATOR);
  }

  createFolderTreeItem(
    node: Folder<string>,
    name: string,
    parent: FolderTreeItem<string>
  ): FolderTreeItem<string> {
    const nChildren = walk(
      node,
      tag => this.foamTags.tags.get(tag)?.length ?? 0
    ).reduce((acc, nResources) => acc + nResources, 0);
    return new TagItem(node, name, name, name, nChildren, [], parent);
  }

  createValueTreeItem(
    value: string,
    parent: FolderTreeItem<string>,
    node: Folder<string>
  ): TagItem {
    const nChildren = walk(
      node,
      tag => this.foamTags.tags.get(tag)?.length ?? 0
    ).reduce((acc, nResources) => acc + nResources, 0);
    const resources = this.foamTags.tags.get(value) ?? [];
    return new TagItem(node, value, value, value, nChildren, resources, parent);
  }

  async getChildren(element?: TagItem): Promise<TagTreeItem[]> {
    if ((element as any)?.getChildren) {
      const children = await (element as any).getChildren();
      return children;
    }
    // This is managed by the FolderTreeProvider
    const subtags = await super.getChildren(element);

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

    return [...subtags, ...resources];
  }

  //   async getChildren2(element?: TagItem): Promise<TagTreeItem[]> {
  //     if ((element as any)?.getChildren) {
  //       const children = await (element as any).getChildren();
  //       return children;
  //     }
  //     const parentTag = element ? element.tag : '';
  //     const parentPrefix = element ? parentTag + TAG_SEPARATOR : '';

  //     const tagsAtThisLevel = this.tags
  //       .filter(({ tag }) => tag.startsWith(parentPrefix))
  //       .map(({ tag }) => {
  //         const nextSeparator = tag.indexOf(TAG_SEPARATOR, parentPrefix.length);
  //         const label =
  //           nextSeparator > -1
  //             ? tag.substring(parentPrefix.length, nextSeparator)
  //             : tag.substring(parentPrefix.length);
  //         const tagId = parentPrefix + label;
  //         return { label, tagId, tag };
  //       })
  //       .reduce((acc, { label, tagId, tag }) => {
  //         const existing = acc.has(label);
  //         const nResources = this.foamTags.tags.get(tag).length ?? 0;
  //         if (!existing) {
  //           acc.set(label, { label, tagId, nResources: 0 });
  //         }
  //         acc.get(label).nResources += nResources;
  //         return acc;
  //       }, new Map() as Map<string, { label: string; tagId: string; nResources: number }>);

  //     const subtags = Array.from(tagsAtThisLevel.values())
  //       .map(({ label, tagId, nResources }) => {
  //         const resources = this.foamTags.tags.get(tagId) ?? [];
  //         return new TagItem(tagId, label, nResources, resources);
  //       })
  //       .sort((a, b) => a.title.localeCompare(b.title));

  //     const resourceTags: ResourceRangeTreeItem[] = (element?.notes ?? [])
  //       .map(uri => this.workspace.get(uri))
  //       .reduce((acc, note) => {
  //         const tags = note.tags.filter(t => t.label === element.tag);
  //         const items = tags.map(t =>
  //           ResourceRangeTreeItem.createStandardItem(
  //             this.workspace,
  //             note,
  //             t.range,
  //             'tag'
  //           )
  //         );
  //         return [...acc, ...items];
  //       }, []);

  //     const resources = await groupRangesByResource(this.workspace, resourceTags);

  //     return Promise.resolve([...subtags, ...resources].filter(Boolean));
  //   }
}

type TagTreeItem = TagItem | ResourceTreeItem | ResourceRangeTreeItem;

export class TagItem extends FolderTreeItem<string> {
  constructor(
    public readonly node: Folder<string>,
    public readonly name: string,
    public readonly tag: string,
    public readonly title: string,
    public readonly nResourcesInSubtree: number,
    public readonly notes: URI[],
    public readonly parentElement?: FolderTreeItem<string>
  ) {
    super(node, title, parentElement);
    this.description = `${nResourcesInSubtree} reference${
      nResourcesInSubtree !== 1 ? 's' : ''
    }`;
  }

  iconPath = new vscode.ThemeIcon('symbol-number');
  contextValue = 'tag';
}

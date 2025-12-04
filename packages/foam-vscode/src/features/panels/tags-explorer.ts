import { URI } from '../../core/model/uri';
import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
import { FoamTags } from '../../core/model/tags';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  expandAll,
  groupRangesByResource,
} from './utils/tree-view-utils';
import {
  Folder,
  FolderTreeItem,
  FolderTreeProvider,
  walk,
} from './utils/folder-tree-provider';
import {
  ContextMemento,
  MapBasedMemento,
  fromVsCodeUri,
} from '../../utils/vsc-utils';

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
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (provider.show.get() === 'for-current-file') {
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand(
      `foam-vscode.views.${provider.providerId}.expand-all`,
      () =>
        expandAll(
          treeView,
          provider,
          node => node.contextValue === 'tag' || node.contextValue === 'folder'
        )
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.${provider.providerId}.focus`,
      async (tag?: string, source?: object) => {
        if (tag == null) {
          tag = await vscode.window.showQuickPick(
            Array.from(foam.tags.tags.keys()),
            {
              title: 'Select a tag to focus',
            }
          );
        }
        if (tag == null) {
          return;
        }
        const tagItem = (await provider.findTreeItemByPath(
          provider.valueToPath(tag)
        )) as TagItem;
        if (tagItem == null) {
          return;
        }
        await treeView.reveal(tagItem, {
          select: true,
          focus: true,
          expand: true,
        });
        const children = await provider.getChildren(tagItem);
        const sourceUri = source ? new URI(source) : undefined;
        const resourceItem = sourceUri
          ? children.find(
              t =>
                t instanceof ResourceTreeItem &&
                sourceUri.isEqual(t.resource?.uri)
            )
          : undefined;
        // doing it as a two reveal process as revealing just the resource
        // was only working when the tag item was already expanded
        if (resourceItem) {
          treeView.reveal(resourceItem, {
            select: true,
            focus: true,
            expand: false,
          });
        }
      }
    )
  );
}

export class TagsProvider extends FolderTreeProvider<TagTreeItem, string> {
  public providerId = 'tags-explorer';
  public show = new ContextMemento<'all' | 'for-current-file'>(
    new MapBasedMemento(),
    `foam-vscode.views.${this.providerId}.show`,
    'all'
  );
  public groupBy = new ContextMemento<'off' | 'folder'>(
    new MapBasedMemento(),
    `foam-vscode.views.${this.providerId}.group-by`,
    'folder'
  );

  private tags: {
    tag: string;
    notes: URI[];
  }[];

  constructor(
    private foamTags: FoamTags,
    private workspace: FoamWorkspace,
    registerCommands: boolean = true
  ) {
    super();
    if (!registerCommands) {
      return;
    }
    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.show:all`,
        () => {
          this.show.update('all');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.show:for-current-file`,
        () => {
          this.show.update('for-current-file');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.group-by:folder`,
        () => {
          this.groupBy.update('folder');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.group-by:off`,
        () => {
          this.groupBy.update('off');
          this.refresh();
        }
      )
    );
  }

  refresh(): void {
    this.tags = [...this.foamTags.tags]
      .map(([tag, resources]) => ({ tag, notes: resources.map(r => r.uri) }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
    super.refresh();
  }

  getValues(): string[] {
    if (this.show.get() === 'for-current-file') {
      const uriInEditor = vscode.window.activeTextEditor?.document.uri;
      const currentResource = this.workspace.find(fromVsCodeUri(uriInEditor));
      return currentResource?.tags.map(t => t.label) ?? [];
    }
    return Array.from(this.tags.values()).map(tag => tag.tag);
  }

  valueToPath(value: string) {
    return this.groupBy.get() === 'off' ? [value] : value.split(TAG_SEPARATOR);
  }

  private countResourcesInSubtree(node: Folder<string>) {
    const uniqueUris = new Set<string>();
    walk(node, tag => {
      const tagLocations = this.foamTags.tags.get(tag) ?? [];
      tagLocations.forEach(location => uniqueUris.add(location.uri.toString()));
      return 0; // Return value not used when collecting URIs
    });
    return uniqueUris.size;
  }

  createFolderTreeItem(
    node: Folder<string>,
    name: string,
    parent: FolderTreeItem<string>
  ): FolderTreeItem<string> {
    const nChildren = this.countResourcesInSubtree(node);
    return new TagItem(node, nChildren, [], parent);
  }

  createValueTreeItem(
    value: string,
    parent: FolderTreeItem<string>,
    node: Folder<string>
  ): TagItem {
    const nChildren = this.countResourcesInSubtree(node);
    const tagLocations = this.foamTags.tags.get(value) ?? [];
    const resourceUris = tagLocations.map(location => location.uri);
    return new TagItem(node, nChildren, resourceUris, parent);
  }

  async getChildren(element?: TagItem): Promise<TagTreeItem[]> {
    if ((element as any)?.getChildren) {
      const children = await (element as any).getChildren();
      return children;
    }

    // Subtags are managed by the FolderTreeProvider
    const subtags = await super.getChildren(element);

    // Compute the resources children
    const resourceTags: ResourceRangeTreeItem[] = [];
    if (element) {
      const tagLocations = this.foamTags.tags.get(element.tag) ?? [];
      const resourceTagPromises = tagLocations.map(async tagLocation => {
        const note = this.workspace.get(tagLocation.uri);
        return ResourceRangeTreeItem.createStandardItem(
          this.workspace,
          note,
          tagLocation.range,
          'tag'
        );
      });
      resourceTags.push(...(await Promise.all(resourceTagPromises)));
    }
    const resources = (
      await groupRangesByResource(this.workspace, resourceTags)
    ).map(item => {
      item.id = element.tag + ' / ' + item.uri.toString();
      return item;
    });

    return [...subtags, ...resources];
  }
}

type TagTreeItem = TagItem | ResourceTreeItem | ResourceRangeTreeItem;

export class TagItem extends FolderTreeItem<string> {
  public readonly tag: string;

  constructor(
    public readonly node: Folder<string>,
    public readonly nResourcesInSubtree: number,
    public readonly notes: URI[],
    public readonly parentElement?: FolderTreeItem<string>
  ) {
    super(node, node.path.slice(-1)[0], parentElement);
    this.tag = node.path.join(TAG_SEPARATOR);
    this.id = this.tag;
    this.description = `${nResourcesInSubtree} reference${
      nResourcesInSubtree !== 1 ? 's' : ''
    }`;
  }

  iconPath = new vscode.ThemeIcon('symbol-number');
  contextValue = 'tag';
}

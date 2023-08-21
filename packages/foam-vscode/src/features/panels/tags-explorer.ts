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
    })
  );
}

export class TagsProvider extends FolderTreeProvider<TagTreeItem, string> {
  private providerId = 'tags-explorer';
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

  constructor(private foamTags: FoamTags, private workspace: FoamWorkspace) {
    super();
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
      .map(([tag, notes]) => ({ tag, notes }))
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
    return this.groupBy.get() === 'folder'
      ? value.split(TAG_SEPARATOR)
      : [value];
  }

  private countResourcesInSubtree(node: Folder<string>) {
    const nChildren = walk(
      node,
      tag => this.foamTags.tags.get(tag)?.length ?? 0
    ).reduce((acc, nResources) => acc + nResources, 0);
    return nChildren;
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
    const resources = this.foamTags.tags.get(value) ?? [];
    return new TagItem(node, nChildren, resources, parent);
  }

  async getChildren(element?: TagItem): Promise<TagTreeItem[]> {
    if ((element as any)?.getChildren) {
      const children = await (element as any).getChildren();
      return children;
    }

    // Subtags are managed by the FolderTreeProvider
    const subtags = await super.getChildren(element);

    // Compute the resources children
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
    this.description = `${nResourcesInSubtree} reference${
      nResourcesInSubtree !== 1 ? 's' : ''
    }`;
  }

  iconPath = new vscode.ThemeIcon('symbol-number');
  contextValue = 'tag';
}

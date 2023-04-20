import * as vscode from 'vscode';
import { Resource } from '../core/model/note';
import { toVsCodeUri } from './vsc-utils';
import { Range } from '../core/model/range';
import { OPEN_COMMAND } from '../features/commands/open-resource';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { getNoteTooltip } from '../utils';
import { isSome } from '../core/utils';
import { groupBy } from 'lodash';
import { getBlockFor } from '../core/services/markdown-parser';

export class UriTreeItem extends vscode.TreeItem {
  private doGetChildren: () => Promise<vscode.TreeItem[]>;

  constructor(
    public readonly uri: URI,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      icon?: string;
      title?: string;
      getChildren?: () => Promise<vscode.TreeItem[]>;
    } = {}
  ) {
    super(
      options?.title ?? uri.getName(),
      options.collapsibleState
        ? options.collapsibleState
        : options.getChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.doGetChildren = options.getChildren;
    this.description = uri.path.replace(
      vscode.workspace.getWorkspaceFolder(toVsCodeUri(uri))?.uri.path,
      ''
    );
    this.tooltip = undefined;
    this.iconPath = new vscode.ThemeIcon(options.icon ?? 'new-file');
  }

  resolveTreeItem(): Promise<UriTreeItem> {
    return Promise.resolve(this);
  }

  getChildren(): Promise<vscode.TreeItem[]> {
    return isSome(this.doGetChildren)
      ? this.doGetChildren()
      : Promise.resolve([]);
  }
}

export class ResourceTreeItem extends UriTreeItem {
  constructor(
    public readonly resource: Resource,
    private readonly workspace: FoamWorkspace,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      getChildren?: () => Promise<vscode.TreeItem[]>;
    } = {}
  ) {
    super(resource.uri, {
      title: resource.title,
      icon: 'note',
      collapsibleState: options.collapsibleState,
      getChildren: options.getChildren,
    });
    this.command = {
      command: 'vscode.open',
      arguments: [toVsCodeUri(resource.uri)],
      title: 'Go to location',
    };

    this.contextValue = 'resource';
  }

  async resolveTreeItem(): Promise<ResourceTreeItem> {
    if (this instanceof ResourceTreeItem) {
      const content = await this.workspace.readAsMarkdown(this.resource.uri);
      this.tooltip = isSome(content)
        ? getNoteTooltip(content)
        : this.resource.title;
    }
    return this;
  }
}

export class ResourceRangeTreeItem extends vscode.TreeItem {
  constructor(
    public label: string,
    public readonly resource: Resource,
    public readonly range: Range,
    private resolveFn?: (
      item: ResourceRangeTreeItem
    ) => Promise<ResourceRangeTreeItem>
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = `${range.start.line}: ${this.label}`;
    this.command = {
      command: 'vscode.open',
      arguments: [toVsCodeUri(resource.uri), { selection: range }],
      title: 'Go to location',
    };
  }

  resolveTreeItem(): Promise<ResourceRangeTreeItem> {
    return this.resolveFn ? this.resolveFn(this) : Promise.resolve(this);
  }

  static async createStandardItem(
    workspace: FoamWorkspace,
    resource: Resource,
    range: Range
  ): Promise<ResourceRangeTreeItem> {
    const markdown = (await workspace.readAsMarkdown(resource.uri)) ?? '';
    const lines = markdown.split('\n');

    const line = lines[range.start.line];
    const start = Math.max(0, range.start.character - 15);
    const ellipsis = start === 0 ? '' : '...';

    const label = line
      ? `${range.start.line}: ${ellipsis}${line.slice(start, start + 300)}`
      : Range.toString(range);

    const resolveFn = (item: ResourceRangeTreeItem) => {
      let { block, nLines } = getBlockFor(markdown, range.start);
      // Long blocks need to be interrupted or they won't display in hover preview
      // We keep the extra lines so that the count in the preview is correct
      if (nLines > 15) {
        let tmp = block.split('\n');
        tmp.splice(15, 1, '\n'); // replace a line with a blank line to interrupt the block
        block = tmp.join('\n');
      }
      const tooltip = getNoteTooltip(block ?? line ?? '');
      item.tooltip = tooltip;
      return Promise.resolve(item);
    };

    const item = new ResourceRangeTreeItem(label, resource, range, resolveFn);
    return item;
  }
}

export const groupRangesByResource = async (
  workspace: FoamWorkspace,
  items:
    | ResourceRangeTreeItem[]
    | Promise<ResourceRangeTreeItem[]>
    | Promise<ResourceRangeTreeItem>[],
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
) => {
  let itemsArray = [] as ResourceRangeTreeItem[];
  if (items instanceof Promise) {
    itemsArray = await items;
  }
  if (items instanceof Array && items[0] instanceof Promise) {
    itemsArray = await Promise.all(items);
  }
  if (items instanceof Array && items[0] instanceof ResourceRangeTreeItem) {
    itemsArray = items as any;
  }
  const byResource = groupBy(itemsArray, item => item.resource.uri.path);
  const resourceItems = Object.values(byResource).map(items => {
    const resourceItem = new ResourceTreeItem(items[0].resource, workspace, {
      collapsibleState,
      getChildren: () => {
        return Promise.resolve(
          items.sort((a, b) => Range.isBefore(a.range, b.range))
        );
      },
    });
    resourceItem.description = `(${items.length}) ${resourceItem.description}`;
    return resourceItem;
  });
  resourceItems.sort((a, b) => Resource.sortByTitle(a.resource, b.resource));
  return resourceItems;
};

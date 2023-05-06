import * as vscode from 'vscode';
import { groupBy } from 'lodash';
import { Resource } from '../core/model/note';
import { toVsCodeUri } from './vsc-utils';
import { Range } from '../core/model/range';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { getNoteTooltip } from '../utils';
import { isSome } from '../core/utils';
import { getBlockFor } from '../core/services/markdown-parser';
import { FoamGraph } from '../core/model/graph';

export class BaseTreeItem extends vscode.TreeItem {
  resolveTreeItem(): Promise<vscode.TreeItem> {
    return Promise.resolve(this);
  }

  getChildren(): Promise<vscode.TreeItem[]> {
    return Promise.resolve([]);
  }
}

export class UriTreeItem extends BaseTreeItem {
  public parent?: vscode.TreeItem;

  constructor(
    public readonly uri: URI,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      title?: string;
      parent?: vscode.TreeItem;
    } = {}
  ) {
    super(options?.title ?? uri.getName(), options.collapsibleState);
    this.parent = options.parent;
    this.description = uri.path.replace(
      vscode.workspace.getWorkspaceFolder(toVsCodeUri(uri))?.uri.path,
      ''
    );
    this.iconPath = new vscode.ThemeIcon('new-file');
  }
}

export class ResourceTreeItem extends UriTreeItem {
  constructor(
    public readonly resource: Resource,
    private readonly workspace: FoamWorkspace,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      parent?: vscode.TreeItem;
    } = {}
  ) {
    super(resource.uri, {
      title: resource.title,
      collapsibleState: options.collapsibleState,
      parent: options.parent,
    });
    this.command = {
      command: 'vscode.open',
      arguments: [toVsCodeUri(resource.uri)],
      title: 'Go to location',
    };
    this.resourceUri = toVsCodeUri(resource.uri);
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = 'foam.resource';
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

export class ResourceRangeTreeItem extends BaseTreeItem {
  constructor(
    public label: string,
    public readonly resource: Resource,
    public readonly range: Range,
    public readonly workspace: FoamWorkspace
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: 'vscode.open',
      arguments: [toVsCodeUri(resource.uri), { selection: range }],
      title: 'Go to location',
    };
  }

  async resolveTreeItem(): Promise<ResourceRangeTreeItem> {
    const markdown =
      (await this.workspace.readAsMarkdown(this.resource.uri)) ?? '';
    let { block, nLines } = getBlockFor(markdown, this.range.start);
    // Long blocks need to be interrupted or they won't display in hover preview
    // We keep the extra lines so that the count in the preview is correct
    if (nLines > 15) {
      let tmp = block.split('\n');
      tmp.splice(15, 1, '\n'); // replace a line with a blank line to interrupt the block
      block = tmp.join('\n');
    }
    const tooltip = getNoteTooltip(block ?? this.label ?? '');
    this.tooltip = tooltip;
    return Promise.resolve(this);
  }

  static async createStandardItem(
    workspace: FoamWorkspace,
    resource: Resource,
    range: Range,
    type?: 'backlink' | 'tag'
  ): Promise<ResourceRangeTreeItem> {
    const markdown = (await workspace.readAsMarkdown(resource.uri)) ?? '';
    const lines = markdown.split('\n');

    const line = lines[range.start.line];
    const start = Math.max(0, range.start.character - 15);
    const ellipsis = start === 0 ? '' : '...';

    const label = line
      ? `${range.start.line + 1}: ${ellipsis}${line.slice(start, start + 300)}`
      : Range.toString(range);

    const item = new ResourceRangeTreeItem(label, resource, range, workspace);
    item.iconPath = new vscode.ThemeIcon(
      type === 'backlink' ? 'arrow-left' : 'symbol-number',
      new vscode.ThemeColor('charts.purple')
    );

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
    });
    resourceItem.getChildren = () =>
      Promise.resolve(items.sort((a, b) => Range.isBefore(a.range, b.range)));
    resourceItem.description = `(${items.length}) ${resourceItem.description}`;
    return resourceItem;
  });
  resourceItems.sort((a, b) => Resource.sortByTitle(a.resource, b.resource));
  return resourceItems;
};

export function createBacklinkItemsForResource(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  uri: URI
) {
  const connections = graph
    .getConnections(uri)
    .filter(c => c.target.asPlain().isEqual(uri));

  const backlinkItems = connections.map(async c => {
    const item = await ResourceRangeTreeItem.createStandardItem(
      workspace,
      workspace.get(c.source),
      c.link.range,
      'backlink'
    );
    item.description = item.label;
    item.label = workspace.get(c.source).title;
    return item;
  });
  return Promise.all(backlinkItems);
}

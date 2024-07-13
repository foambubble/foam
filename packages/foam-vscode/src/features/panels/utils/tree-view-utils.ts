import * as vscode from 'vscode';
import { groupBy } from 'lodash';
import { Resource } from '../../../core/model/note';
import { toVsCodeUri } from '../../../utils/vsc-utils';
import { Range } from '../../../core/model/range';
import { URI } from '../../../core/model/uri';
import { FoamWorkspace } from '../../../core/model/workspace';
import { isSome } from '../../../core/utils';
import { getBlockFor } from '../../../core/services/markdown-parser';
import { Connection, FoamGraph } from '../../../core/model/graph';
import { Logger } from '../../../core/utils/log';
import { getNoteTooltip } from '../../../services/editor';

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
    this.iconPath = new vscode.ThemeIcon('link');
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
  public value: any;
  constructor(
    public label: string,
    public variant: string,
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

  static icons = {
    backlink: new vscode.ThemeIcon(
      'arrow-left',
      new vscode.ThemeColor('charts.purple')
    ),
    link: new vscode.ThemeIcon(
      'arrow-right',
      new vscode.ThemeColor('charts.purple')
    ),
    tag: new vscode.ThemeIcon(
      'symbol-number',
      new vscode.ThemeColor('charts.purple')
    ),
  };
  static async createStandardItem(
    workspace: FoamWorkspace,
    resource: Resource,
    range: Range,
    variant: 'backlink' | 'tag' | 'link'
  ): Promise<ResourceRangeTreeItem> {
    const markdown = (await workspace.readAsMarkdown(resource.uri)) ?? '';
    const lines = markdown.split('\n');

    const line = lines[range.start.line];
    const start = Math.max(0, range.start.character - 15);
    const ellipsis = start === 0 ? '' : '...';

    const label = line
      ? `${range.start.line + 1}: ${ellipsis}${line.slice(start, start + 300)}`
      : Range.toString(range);

    const item = new ResourceRangeTreeItem(
      label,
      variant,
      resource,
      range,
      workspace
    );
    item.iconPath = ResourceRangeTreeItem.icons[variant];

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
    const children = items.sort((a, b) => Range.isBefore(a.range, b.range));
    resourceItem.getChildren = () => Promise.resolve(children);
    resourceItem.description = `(${items.length}) ${resourceItem.description}`;
    resourceItem.command = children[0].command;
    return resourceItem;
  });
  resourceItems.sort((a, b) => Resource.sortByTitle(a.resource, b.resource));
  return resourceItems;
};

export function createBacklinkItemsForResource(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  uri: URI,
  variant: 'backlink' | 'link' = 'backlink'
) {
  const connections = graph
    .getConnections(uri)
    .filter(c => c.target.asPlain().isEqual(uri));

  const backlinkItems = connections.map(async c =>
    ResourceRangeTreeItem.createStandardItem(
      workspace,
      workspace.get(c.source),
      c.link.range,
      variant
    )
  );
  return Promise.all(backlinkItems);
}

export function createConnectionItemsForResource(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  uri: URI,
  filter: (c: Connection) => boolean = () => true
) {
  const connections = graph.getConnections(uri).filter(c => filter(c));

  const backlinkItems = connections.map(async c => {
    const item = await ResourceRangeTreeItem.createStandardItem(
      workspace,
      workspace.get(c.source),
      c.link.range,
      c.source.asPlain().isEqual(uri) ? 'link' : 'backlink'
    );
    item.value = c;
    return item;
  });
  return Promise.all(backlinkItems);
}

/**
 * Expands a node and its children in a tree view that match a given predicate
 *
 * @param treeView - The tree view to expand nodes in
 * @param provider - The tree data provider for the view
 * @param element - The element to expand
 * @param when - A function that returns true if the node should be expanded
 */
export async function expandNode<T>(
  treeView: vscode.TreeView<any>,
  provider: vscode.TreeDataProvider<T>,
  element: T,
  when: (element: T) => boolean
) {
  try {
    if (when(element)) {
      await treeView.reveal(element, {
        select: false,
        focus: false,
        expand: true,
      });
    }
  } catch (e) {
    const obj = element as any;
    const label = obj.label ?? obj.toString();
    Logger.warn(
      `Could not expand element: ${label}. Try setting the ID property of the TreeItem`
    );
  }

  const children = await provider.getChildren(element);
  for (const child of children) {
    await expandNode(treeView, provider, child, when);
  }
}

/**
 * Expands all items in a tree view that match a given predicate
 *
 * @param treeView - The tree view to expand items in
 * @param provider - The tree data provider for the view
 * @param when - A function that returns true if the node should be expanded
 */
export async function expandAll<T>(
  treeView: vscode.TreeView<T>,
  provider: vscode.TreeDataProvider<T>,
  when: (element: T) => boolean = () => true
) {
  const elements = await provider.getChildren(undefined);
  for (const element of elements) {
    await expandNode(treeView, provider, element, when);
  }
}

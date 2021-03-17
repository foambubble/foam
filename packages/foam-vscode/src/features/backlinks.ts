import * as vscode from 'vscode';
import { groupBy } from 'lodash';
import {
  Foam,
  FoamWorkspace,
  IDataStore,
  isNote,
  NoteLink,
  Resource,
  isSameUri,
  URI,
  Range,
} from 'foam-core';
import { getNoteTooltip } from '../utils';
import { FoamFeature } from '../types';
import { ResourceTreeItem } from '../utils/grouped-resources-tree-data-provider';
import { Position } from 'unist';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const provider = new BacklinksTreeDataProvider(
      foam.workspace,
      foam.services.dataStore
    );

    vscode.window.onDidChangeActiveTextEditor(async () => {
      provider.target = vscode.window.activeTextEditor?.document.uri;
      await provider.refresh();
    });

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.backlinks', provider),
      foam.workspace.onDidAdd(() => provider.refresh()),
      foam.workspace.onDidUpdate(() => provider.refresh()),
      foam.workspace.onDidDelete(() => provider.refresh())
    );
  },
};
export default feature;

const isBefore = (a: Range, b: Range) =>
  a.start.line - b.start.line || a.start.character - b.start.character;

export class BacklinksTreeDataProvider
  implements vscode.TreeDataProvider<BacklinkPanelTreeItem> {
  public target?: URI = undefined;
  // prettier-ignore
  private _onDidChangeTreeDataEmitter = new vscode.EventEmitter<BacklinkPanelTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeDataEmitter.event;

  constructor(
    private workspace: FoamWorkspace,
    private dataStore: IDataStore
  ) {}

  refresh(): void {
    this._onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(item: BacklinkPanelTreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(item?: ResourceTreeItem): Thenable<BacklinkPanelTreeItem[]> {
    const uri = this.target;
    if (item) {
      const resource = item.resource;
      if (!isNote(resource)) {
        return Promise.resolve([]);
      }

      const backlinkRefs = Promise.all(
        resource.links
          .filter(link =>
            isSameUri(this.workspace.resolveLink(resource, link), uri)
          )
          .map(async link => {
            const item = new BacklinkTreeItem(resource, link);
            const lines = (await this.dataStore.read(resource.uri)).split('\n');
            if (link.range.start.line < lines.length) {
              const line = lines[link.range.start.line];
              let start = Math.max(0, link.range.start.character - 15);
              const ellipsis = start === 0 ? '' : '...';

              item.label = `${link.range.start.line}: ${ellipsis}${line.substr(
                start,
                300
              )}`;
              item.tooltip = getNoteTooltip(line);
            }
            return item;
          })
      );

      return backlinkRefs;
    }

    if (!uri || !this.dataStore.isMatch(uri)) {
      return Promise.resolve([]);
    }

    const backlinksByResourcePath = groupBy(
      this.workspace.getConnections(uri).filter(c => isSameUri(c.target, uri)),
      b => b.source.path
    );

    const resources = Object.keys(backlinksByResourcePath)
      .map(res => backlinksByResourcePath[res][0].source)
      .map(uri => this.workspace.get(uri))
      .filter(isNote)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(note => {
        const connections = backlinksByResourcePath[
          note.uri.path
        ].sort((a, b) => isBefore(a.link.range, b.link.range));
        const item = new ResourceTreeItem(
          note,
          this.dataStore,
          vscode.TreeItemCollapsibleState.Expanded
        );
        item.description = `(${connections.length}) ${item.description}`;
        return item;
      });
    return Promise.resolve(resources);
  }

  resolveTreeItem(item: BacklinkPanelTreeItem): Promise<BacklinkPanelTreeItem> {
    return item.resolveTreeItem();
  }
}

export class BacklinkTreeItem extends vscode.TreeItem {
  constructor(
    public readonly resource: Resource,
    public readonly link: NoteLink
  ) {
    super(
      link.type === 'wikilink' ? link.slug : link.label,
      vscode.TreeItemCollapsibleState.None
    );
    this.label = `${link.range.start.line}: ${this.label}`;
    this.command = {
      command: 'vscode.open',
      arguments: [resource.uri, { selection: link.range }],
      title: 'Go to link',
    };
  }

  resolveTreeItem(): Promise<BacklinkTreeItem> {
    return Promise.resolve(this);
  }
}

type BacklinkPanelTreeItem = ResourceTreeItem | BacklinkTreeItem;

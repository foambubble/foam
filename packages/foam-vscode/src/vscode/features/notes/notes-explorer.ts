import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  createBacklinkItemsForResource as createBacklinkTreeItemsForResource,
} from '../../utils/tree-views/tree-view-utils';
import { Resource } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { ContextMemento, toVsCodeUri } from '../../utils/vsc-utils';
import {
  getActiveTabUri,
  onDidChangeActiveTab,
} from '../../services/editor';
import {
  Folder,
  FolderTreeItem,
  FolderTreeProvider,
  pruneEmptyFolders,
} from '../../utils/tree-views/folder-tree-provider';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  const provider = new NotesProvider(
    foam.workspace,
    foam.graph,
    context.globalState
  );
  provider.refresh();
  const treeView = vscode.window.createTreeView<NotesTreeItems>(
    'foam-vscode.notes-explorer',
    {
      treeDataProvider: provider,
      canSelectMany: true,
    }
  );
  const revealActiveNoteItem = async () => {
    const target = getActiveTabUri(foam.workspace);
    if (treeView.visible) {
      if (target) {
        const item = await findTreeItemByUri(provider, toVsCodeUri(target));
        // Check if the item is already selected.
        // This check is needed because always calling reveal() will
        // cause the tree view to take the focus from the item when
        // browsing the notes explorer
        if (
          item &&
          !treeView.selection.find(
            i => i.resourceUri?.path === item.resourceUri.path
          )
        ) {
          treeView.reveal(item);
        }
      }
    }
  };

  const applyFilter = async (text: string) => {
    provider.setFilter(text);
    provider.refresh();
    treeView.message = text ? `Filtering: "${text}"` : undefined;
    vscode.commands.executeCommand(
      'setContext',
      'foam-vscode.views.notes-explorer.filter-active',
      !!text
    );
    if (!text) {
      await vscode.commands.executeCommand(
        'workbench.actions.treeView.foam-vscode.notes-explorer.collapseAll'
      );
    }
  };

  context.subscriptions.push(
    treeView,
    provider,
    foam.graph.onDidUpdate(() => {
      provider.refresh();
    }),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.collapse-all`,
      () =>
        vscode.commands.executeCommand(
          'workbench.actions.treeView.foam-vscode.notes-explorer.collapseAll'
        )
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.connections:toggle`,
      async () => {
        await provider.showConnections.update(
          provider.showConnections.get() === 'show' ? 'hide' : 'show'
        );
        provider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.include:notes-only`,
      async () => {
        await provider.include.update('notes-only');
        provider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.include:all`,
      async () => {
        await provider.include.update('all');
        provider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.view:toggle`,
      async () => {
        await provider.viewMode.update(
          provider.viewMode.get() === 'hierarchy' ? 'flat' : 'hierarchy'
        );
        provider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.set-filter`,
      () => {
        const inputBox = vscode.window.createInputBox();
        inputBox.prompt = 'Filter notes by title or path';
        inputBox.value = provider.getFilter();
        inputBox.placeholder = 'Type to filter...';

        const disposables = [
          inputBox.onDidChangeValue(text => applyFilter(text)),
          inputBox.onDidAccept(() => inputBox.hide()),
          inputBox.onDidHide(() => {
            disposables.forEach(d => d.dispose());
            inputBox.dispose();
          }),
        ];

        inputBox.show();
      }
    ),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.clear-filter`,
      () => applyFilter('')
    ),
    onDidChangeActiveTab(revealActiveNoteItem),
    treeView.onDidChangeVisibility(revealActiveNoteItem)
  );
}

export function findTreeItemByUri<I, T>(
  provider: FolderTreeProvider<I, T>,
  target: vscode.Uri
) {
  const path = vscode.workspace.asRelativePath(
    target,
    vscode.workspace.workspaceFolders.length > 1
  );
  return provider.findTreeItemByPath(path.split('/'));
}

export type NotesTreeItems =
  | ResourceTreeItem
  | FolderTreeItem<Resource>
  | ResourceRangeTreeItem;

export class NotesProvider extends FolderTreeProvider<
  NotesTreeItems,
  Resource
> {
  public include: ContextMemento<'all' | 'notes-only'>;
  public showConnections: ContextMemento<'show' | 'hide'>;
  public viewMode: ContextMemento<'hierarchy' | 'flat'>;
  private filterText: string = '';

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private state: vscode.Memento
  ) {
    super();
    this.include = new ContextMemento<'all' | 'notes-only'>(
      this.state,
      `foam-vscode.views.notes-explorer.include`,
      'notes-only'
    );
    this.showConnections = new ContextMemento<'show' | 'hide'>(
      this.state,
      `foam-vscode.views.notes-explorer.connections`,
      'hide'
    );
    this.viewMode = new ContextMemento<'hierarchy' | 'flat'>(
      this.state,
      `foam-vscode.views.notes-explorer.view-mode`,
      'flat'
    );
  }

  setFilter(text: string) {
    this.filterText = text;
  }

  getFilter(): string {
    return this.filterText;
  }

  protected postCreateTree(): void {
    if (this.filterText && this.root) {
      pruneEmptyFolders(this.root);
    }
  }

  createFolderTreeItem(
    node: Folder<Resource>,
    name: string,
    parent: FolderTreeItem<Resource>
  ): FolderTreeItem<Resource> {
    const item = super.createFolderTreeItem(node, name, parent);
    if (this.filterText) {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      // Assign a unique id so VS Code treats this as a new item and
      // honours collapsibleState = Expanded rather than its cached state
      item.id = `filtered:${node.path.join('/')}`;
    }
    return item;
  }

  async getChildren(item?: NotesTreeItems): Promise<NotesTreeItems[]> {
    if (this.viewMode.get() === 'flat' && item == null) {
      const filterFn = this.getFilterFn();
      return this.getValues()
        .filter(filterFn)
        .map(v => this.createValueTreeItem(v, undefined))
        .sort((a, b) =>
          (a as ResourceTreeItem).label
            .toString()
            .localeCompare((b as ResourceTreeItem).label.toString())
        ) as NotesTreeItems[];
    }
    return super.getChildren(item);
  }

  findTreeItemByPath(path: string[]): Promise<NotesTreeItems> {
    if (this.viewMode.get() === 'flat') {
      const fullPath = path.join('/');
      const filterFn = this.getFilterFn();
      const value = this.getValues().find(v => {
        if (!filterFn(v)) return false;
        const relPath = vscode.workspace.asRelativePath(
          v.uri.path,
          vscode.workspace.workspaceFolders.length > 1
        );
        return relPath === fullPath;
      });
      return Promise.resolve(
        value
          ? (this.createValueTreeItem(value, undefined) as NotesTreeItems)
          : null
      );
    }
    return super.findTreeItemByPath(path);
  }

  getValues() {
    return this.workspace.list();
  }

  getFilterFn() {
    const showFilter =
      this.include.get() === 'notes-only'
        ? (res: Resource) => res.type !== 'image' && res.type !== 'attachment'
        : () => true;

    if (!this.filterText) {
      return showFilter;
    }

    const needle = this.filterText.toLowerCase();
    return (res: Resource) => {
      if (!showFilter(res)) return false;
      return (
        res.title.toLowerCase().includes(needle) ||
        res.uri.path.toLowerCase().includes(needle)
      );
    };
  }

  valueToPath(value: Resource) {
    const path = vscode.workspace.asRelativePath(
      value.uri.path,
      vscode.workspace.workspaceFolders.length > 1
    );
    const parts = path.split('/');
    return parts;
  }

  createValueTreeItem(
    value: Resource,
    parent: FolderTreeItem<Resource>
  ): NotesTreeItems {
    const connectionsVisible = this.showConnections.get() === 'show';
    const item = new ResourceTreeItem(value, this.workspace, {
      parent,
      collapsibleState:
        connectionsVisible && this.graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    });
    item.id = value.uri.toString();
    item.getChildren = async () => {
      const backlinks = await createBacklinkTreeItemsForResource(
        this.workspace,
        this.graph,
        item.uri
      );
      backlinks.forEach(item => {
        item.description = item.label;
        item.label = item.resource.title;
      });
      return backlinks;
    };
    const baseDescription = (() => {
      if (this.viewMode.get() === 'flat') {
        const parts = this.valueToPath(value);
        return parts.length > 1 ? parts.slice(0, -1).join('/') : undefined;
      }
      return value.uri.getName().toLocaleLowerCase() ===
        value.title.toLocaleLowerCase()
        ? undefined
        : value.uri.getBasename();
    })();

    const links = this.graph.getLinks(value.uri).length;
    const backlinks = this.graph.getBacklinks(value.uri).length;
    const counts =
      links > 0 || backlinks > 0 ? `↑${links} ↓${backlinks}` : undefined;
    item.description =
      [baseDescription, counts].filter(Boolean).join(' - ') || undefined;
    return item;
  }
}

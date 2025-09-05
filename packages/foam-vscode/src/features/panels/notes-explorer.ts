import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  TrainTreeItem,
  createBacklinkItemsForResource as createBacklinkTreeItemsForResource,
  expandAll,
} from './utils/tree-view-utils';
import { Resource } from '../../core/model/note';
import { FoamGraph } from '../../core/model/graph';
import { ContextMemento } from '../../utils/vsc-utils';
import {
  FolderTreeItem,
  FolderTreeProvider,
} from './utils/folder-tree-provider';
import { TrainNote } from '../../core/model/train-note';
import { URI } from '../../core/model/uri';

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
      showCollapseAll: true,
      canSelectMany: true,
    }
  );
  const revealTextEditorItem = async () => {
    const target = vscode.window.activeTextEditor?.document.uri;
    if (treeView.visible) {
      if (target) {
        const item = await findTreeItemByUri(provider, target);
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

  context.subscriptions.push(
    treeView,
    provider,
    foam.graph.onDidUpdate(() => {
      provider.refresh();
    }),
    vscode.commands.registerCommand(
      `foam-vscode.views.notes-explorer.expand-all`,
      (...args) =>
        expandAll(treeView, provider, node => node.contextValue === 'folder')
    ),
    vscode.window.onDidChangeActiveTextEditor(revealTextEditorItem),
    treeView.onDidChangeVisibility(revealTextEditorItem)
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
  | TrainTreeItem
  | FolderTreeItem<Resource>
  | ResourceRangeTreeItem;

export class NotesProvider extends FolderTreeProvider<
  NotesTreeItems,
  Resource
> {
  public show: ContextMemento<'all' | 'notes-only'>;

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private state: vscode.Memento
  ) {
    super();
    this.show = new ContextMemento<'all' | 'notes-only'>(
      this.state,
      `foam-vscode.views.notes-explorer.show`,
      'all'
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.notes-explorer.show:all`,
        () => {
          this.show.update('all');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.notes-explorer.show:notes`,
        () => {
          this.show.update('notes-only');
          this.refresh();
        }
      )
    );
  }

  getValues() {
    return this.workspace
      .list()
      .concat(this.workspace.trainNoteWorkspace.list());
  }

  getFilterFn() {
    return this.show.get() === 'notes-only'
      ? res => res.type !== 'image' && res.type !== 'attachment'
      : () => true;
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
    value: Resource | TrainNote,
    parent: FolderTreeItem<Resource>
  ): NotesTreeItems {
    return new TreeFactory().make(value, this.workspace, this.graph, {
      parent: parent,
      collapsibleState:
        this.graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    });
  }
}

export class TreeFactory {
  make(
    value: Resource | TrainNote,
    workspace: FoamWorkspace,
    graph: FoamGraph,
    options: {
      collapsibleState?: vscode.TreeItemCollapsibleState;
      parent?: FolderTreeItem<Resource>;
    }
  ) {
    const builder =
      value instanceof TrainNote
        ? new TrainTreeItemBuilder(value, workspace)
        : new ResourceTreeItemBuilder(value, workspace);

    return builder
      .setDescription()
      .setWorkspace(workspace)
      .setOptions(options.parent, options.collapsibleState)
      .setGraph(graph)
      .build();
  }
}

abstract class TreeItemBuilder<Tvalue extends { uri: URI }, TtreeItem> {
  protected value: Tvalue;
  protected workspace: FoamWorkspace;
  protected description: string;
  protected graph: FoamGraph;
  protected options: {
    collapsibleState?: vscode.TreeItemCollapsibleState;
    parent?: vscode.TreeItem;
  };

  constructor(value: Tvalue, workspace: FoamWorkspace) {
    this.value = value;
    this.workspace = workspace;
  }

  setOptions(
    parent: FolderTreeItem<Resource>,
    state: vscode.TreeItemCollapsibleState
  ) {
    this.options = {
      collapsibleState: state,
      parent: parent,
    };
    return this;
  }

  abstract setDescription(): this;

  setWorkspace(ws: FoamWorkspace) {
    this.workspace = ws;
    return this;
  }

  setGraph(graph: FoamGraph) {
    this.graph = graph;
    return this;
  }

  setChildren(graph: FoamGraph) {
    return async () => {
      const backlinks = await createBacklinkTreeItemsForResource(
        this.workspace,
        graph,
        this.value.uri
      );
      backlinks.forEach(b => {
        b.description = b.label;
        b.label = b.resource.title;
      });
      return backlinks;
    };
  }

  abstract build(): TtreeItem;
}

class ResourceTreeItemBuilder extends TreeItemBuilder<
  Resource,
  ResourceTreeItem
> {
  setDescription() {
    this.description =
      this.value.uri.getName().toLowerCase() === this.value.title.toLowerCase()
        ? undefined
        : this.value.uri.getBasename();
    return this;
  }

  build(): ResourceTreeItem {
    const item = new ResourceTreeItem(this.value, this.workspace, this.options);
    item.id = this.value.uri.toString();
    item.getChildren = this.setChildren(this.graph);
    item.description = this.description;
    return item;
  }
}

export class TrainTreeItemBuilder extends TreeItemBuilder<
  TrainNote,
  TrainTreeItem
> {
  setDescription() {
    this.description =
      this.value.uri.getName().toLowerCase() === this.value.title.toLowerCase()
        ? undefined
        : this.value.uri.getBasename();
    return this;
  }

  build(): TrainTreeItem {
    const item = new TrainTreeItem(this.value, this.workspace, this.options);
    item.id = this.value.uri.toString();
    item.getChildren = this.setChildren(this.graph);
    item.description = this.description;
    return item;
  }
}

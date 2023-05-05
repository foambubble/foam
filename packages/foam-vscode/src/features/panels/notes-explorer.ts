import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
  createBacklinkItemsForResource as createBacklinkTreeItemsForResource,
} from '../../utils/tree-view-utils';
import { Resource } from '../../core/model/note';
import { FoamGraph } from '../../core/model/graph';
import { ContextMemento } from '../../utils/vsc-utils';
import {
  FolderTreeItem,
  FolderTreeProvider,
} from './utils/folder-tree-provider';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
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
      vscode.window.onDidChangeActiveTextEditor(revealTextEditorItem),
      treeView.onDidChangeVisibility(revealTextEditorItem)
    );
  },
};

export default feature;

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
  public show = new ContextMemento<'all' | 'notes-only'>(
    this.state,
    `foam-vscode.views.notes-explorer.show`,
    'all'
  );

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private state: vscode.Memento
  ) {
    super();
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
    return this.workspace.list();
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

  isValueType(value: Resource): value is Resource {
    return value.uri != null;
  }

  createValueTreeItem(
    value: Resource,
    parent: FolderTreeItem<Resource>
  ): NotesTreeItems {
    const res = new ResourceTreeItem(value, this.workspace, {
      parent,
      collapsibleState:
        this.graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    });
    res.getChildren = async () => {
      const backlinks = await createBacklinkTreeItemsForResource(
        this.workspace,
        this.graph,
        res.uri
      );
      return backlinks;
    };
    return res;
  }
}

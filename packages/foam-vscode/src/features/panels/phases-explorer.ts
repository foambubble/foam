import * as vscode from 'vscode';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
import {
  ResourceRangeTreeItem,
  TrainTreeItem,
  expandAll,
} from './utils/tree-view-utils';
import { FoamGraph } from '../../core/model/graph';
import {
  Folder,
  FolderTreeItem,
  FolderTreeProvider,
} from './utils/folder-tree-provider';
import { TrainNote } from '../../core/model/train-note';
import { TrainTreeItemBuilder } from './notes-explorer';
import { Foam } from '../../core/model/foam';
import { URI } from '../../core/model/uri';
import { Phase } from '../../core/model/phase';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  const provider = new PhasesProvider(
    foam.workspace,
    foam.graph,
    context.globalState
  );
  provider.refresh();
  const treeView = vscode.window.createTreeView<TrainTreeItems>(
    'foam-vscode.phases-explorer',
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
      `foam-vscode.views.phases-explorer.expand-all`,
      (...args) =>
        expandAll(treeView, provider, node => node.contextValue === 'folder')
    ),
    vscode.window.onDidChangeActiveTextEditor(revealTextEditorItem),
    treeView.onDidChangeVisibility(revealTextEditorItem)
  );
}

function findTreeItemByUri<I, T>(
  provider: FolderTreeProvider<I, T>,
  target: vscode.Uri
) {
  return provider.findTreeItemByPath(target.fsPath.split('/'));
}

type TrainTreeItems = TrainTreeItem | ResourceRangeTreeItem;
export class PhasesProvider extends FolderTreeProvider<
  TrainTreeItems,
  TrainNote
> {
  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private state: vscode.Memento
  ) {
    super();
  }

  getValues() {
    const updatePhase = (notes: TrainNote[], phase: Phase): TrainNote[] => {
      return notes.map(note => ({
        ...note,
        currentPhase: phase,
      }));
    };

    const lates = updatePhase(
      this.workspace.trainNoteWorkspace.late(),
      new Phase('Late', -1)
    );

    const today = updatePhase(
      this.workspace.trainNoteWorkspace.today(),
      new Phase('Today', 0)
    );

    return this.workspace.trainNoteWorkspace.list().concat(lates, today);
  }

  getFilterFn() {
    return () => true;
  }

  valueToPath(value: TrainNote) {
    return [value.currentPhase.name, value.title];
  }

  createValueTreeItem(
    value: TrainNote,
    parent: FolderTreeItem<TrainNote>,
    node: Folder<TrainNote>
  ) {
    return new TrainTreeItemBuilder(value, this.workspace)
      .setDescription()
      .setWorkspace(this.workspace)
      .setOptions(
        parent,
        this.graph.getBacklinks(value.uri).length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      )
      .setGraph(this.graph)
      .build();
  }

  override getTreeItemsHierarchy(path: string[]): vscode.TreeItem[] {
    const uri = URI.parse(path.join('/'));
    const target = this.workspace.trainNoteWorkspace.get(uri);
    if (target) {
      return super.getTreeItemsHierarchy([
        target.currentPhase.name,
        target.title,
      ]);
    }
  }
}

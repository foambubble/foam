import * as vscode from 'vscode';
import { Foam } from '../../../core/model/foam';
import { FoamWorkspace } from '../../../core/model/workspace';
import { URI } from '../../../core/model/uri';
import { fromVsCodeUri } from '../../../utils/vsc-utils';
import { BaseTreeProvider } from '../../../features/panels/utils/base-tree-provider';
import { ResourceTreeItem } from '../../../features/panels/utils/tree-view-utils';
import { FoamEmbeddings } from '../../../ai/model/embeddings';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const provider = new RelatedNotesTreeDataProvider(
    foam.workspace,
    foam.embeddings,
    context.globalState
  );

  const treeView = vscode.window.createTreeView('foam-vscode.related-notes', {
    treeDataProvider: provider,
    showCollapseAll: false,
  });

  const updateTreeView = async () => {
    const activeEditor = vscode.window.activeTextEditor;
    provider.target = activeEditor
      ? fromVsCodeUri(activeEditor.document.uri)
      : undefined;
    await provider.refresh();

    // Update context for conditional viewsWelcome messages
    vscode.commands.executeCommand(
      'setContext',
      'foam.relatedNotes.state',
      provider.getState()
    );
  };

  updateTreeView();

  context.subscriptions.push(
    provider,
    treeView,
    foam.embeddings.onDidUpdate(() => updateTreeView()),
    vscode.window.onDidChangeActiveTextEditor(() => updateTreeView()),
    provider.onDidChangeTreeData(() => {
      treeView.title = `Related Notes (${provider.nValues})`;
    })
  );
}

export class RelatedNotesTreeDataProvider extends BaseTreeProvider<vscode.TreeItem> {
  public target?: URI = undefined;
  public nValues = 0;
  private relatedNotes: Array<{ uri: URI; similarity: number }> = [];
  private currentNoteHasEmbedding = false;

  constructor(
    private workspace: FoamWorkspace,
    private embeddings: FoamEmbeddings,
    public state: vscode.Memento
  ) {
    super();
  }

  async refresh(): Promise<void> {
    const uri = this.target;

    // Clear if no target or target is not a note
    if (!uri) {
      this.relatedNotes = [];
      this.nValues = 0;
      this.currentNoteHasEmbedding = false;
      super.refresh();
      return;
    }

    const resource = this.workspace.find(uri);
    if (!resource || resource.type !== 'note') {
      this.relatedNotes = [];
      this.nValues = 0;
      this.currentNoteHasEmbedding = false;
      super.refresh();
      return;
    }

    // Check if current note has an embedding
    this.currentNoteHasEmbedding = this.embeddings.getEmbedding(uri) !== null;

    // Get similar notes (user can click "Build Embeddings" button if needed)
    const similar = this.embeddings.getSimilar(uri, 10);
    this.relatedNotes = similar.filter(n => n.similarity > 0.6);
    this.nValues = this.relatedNotes.length;
    super.refresh();
  }

  async getChildren(item?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (item) {
      return [];
    }

    // If no related notes found, show appropriate message in viewsWelcome
    // The empty array will trigger the viewsWelcome content
    if (this.relatedNotes.length === 0) {
      return [];
    }

    return this.relatedNotes
      .map(({ uri, similarity }) => {
        const resource = this.workspace.find(uri);
        if (!resource) {
          return null;
        }

        const item = new ResourceTreeItem(resource, this.workspace);
        // Show similarity score as percentage in description
        item.description = `${Math.round(similarity * 100)}%`;
        return item;
      })
      .filter(item => item !== null) as ResourceTreeItem[];
  }

  /**
   * Returns the current state of the related notes panel
   */
  public getState(): 'no-note' | 'no-embedding' | 'ready' {
    if (!this.target) {
      return 'no-note';
    }
    if (!this.currentNoteHasEmbedding) {
      return 'no-embedding';
    }
    return 'ready';
  }
}

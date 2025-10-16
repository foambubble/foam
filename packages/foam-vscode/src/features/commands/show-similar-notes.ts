import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { URI } from '../../core/model/uri';
import { CancellationError } from '../../core/services/progress';

export const SHOW_SIMILAR_NOTES_COMMAND = {
  command: 'foam-vscode.show-similar-notes',
  title: 'Foam: Show Similar Notes',
};

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      SHOW_SIMILAR_NOTES_COMMAND.command,
      async () => {
        await showSimilarNotes(foam);
      }
    )
  );
}

async function showSimilarNotes(foam: Foam): Promise<void> {
  // Get the active editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('No active editor found');
    return;
  }

  // Get the URI of the active document
  const uri = fromVsCodeUri(editor.document.uri);

  // Check if the resource exists in workspace
  const resource = foam.workspace.find(uri);
  if (!resource) {
    vscode.window.showInformationMessage('Current file is not a Foam resource');
    return;
  }

  // Ensure embeddings are up-to-date (incremental update)
  const status = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Updating embeddings...',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        await foam.embeddings.update(progressInfo => {
          const increment = (1 / progressInfo.total) * 100;
          progress.report({
            increment: increment,
            message: `${progressInfo.current}/${progressInfo.total}`,
          });
        }, token);
        return 'complete';
      } catch (error) {
        if (error instanceof CancellationError) {
          return 'cancelled';
        }
        // Log other errors but continue
        vscode.window.showWarningMessage(
          `Failed to update some embeddings: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
        return 'error';
      }
    }
  );

  if (status !== 'complete') {
    return;
  }

  // Check if embedding exists for this resource
  const embedding = foam.embeddings.getEmbedding(uri);
  if (!embedding) {
    vscode.window.showInformationMessage(
      'No embedding found for current note. The embedding provider may not be available.'
    );
    return;
  }

  // Get similar notes
  const similar = foam.embeddings.getSimilar(uri, 10);

  if (similar.length === 0) {
    vscode.window.showInformationMessage('No similar notes found');
    return;
  }

  // Create quick pick items
  const items: vscode.QuickPickItem[] = similar.map(item => {
    const resource = foam.workspace.find(item.uri);
    const title = resource?.title || item.uri.getBasename();
    const similarityPercent = (item.similarity * 100).toFixed(1);

    return {
      label: `$(file) ${title}`,
      description: `${similarityPercent}% similar`,
      detail: item.uri.toFsPath(),
      uri: item.uri,
    } as vscode.QuickPickItem & { uri: URI };
  });

  // Show quick pick
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a similar note to open',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    const selectedUri = (selected as any).uri as URI;
    const doc = await vscode.workspace.openTextDocument(
      toVsCodeUri(selectedUri)
    );
    await vscode.window.showTextDocument(doc);
  }
}

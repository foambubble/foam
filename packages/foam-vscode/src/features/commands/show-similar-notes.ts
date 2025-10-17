import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { URI } from '../../core/model/uri';
import { BUILD_EMBEDDINGS_COMMAND } from './build-embeddings';

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
    vscode.window.showInformationMessage('Please open a note first');
    return;
  }

  // Get the URI of the active document
  const uri = fromVsCodeUri(editor.document.uri);

  // Check if the resource exists in workspace
  const resource = foam.workspace.find(uri);
  if (!resource) {
    vscode.window.showInformationMessage('This file is not a note');
    return;
  }

  // Ensure embeddings are up-to-date (incremental update)
  const status: 'complete' | 'error' | 'cancelled' =
    await vscode.commands.executeCommand(BUILD_EMBEDDINGS_COMMAND.command);

  if (status !== 'complete') {
    return;
  }

  // Check if embedding exists for this resource
  const embedding = foam.embeddings.getEmbedding(uri);
  if (!embedding) {
    vscode.window.showInformationMessage(
      'This note hasn\'t been analyzed yet. Make sure the AI service is running and try the "Analyze Notes with AI" command.'
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

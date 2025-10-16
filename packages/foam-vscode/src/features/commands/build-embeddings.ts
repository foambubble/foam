import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { CancellationError } from '../../core/services/progress';

export const BUILD_EMBEDDINGS_COMMAND = {
  command: 'foam-vscode.build-embeddings',
  title: 'Foam: Build Embeddings Index',
};

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      BUILD_EMBEDDINGS_COMMAND.command,
      async () => {
        await buildEmbeddings(foam);
      }
    )
  );
}

async function buildEmbeddings(foam: Foam): Promise<void> {
  const resourceCount = foam.workspace.list().length;

  if (resourceCount === 0) {
    vscode.window.showInformationMessage('No resources found in workspace');
    return;
  }

  // Show progress notification
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Building embeddings...',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        await foam.embeddings.update(progressInfo => {
          const title = progressInfo.context?.title || 'Processing...';
          const increment = (1 / progressInfo.total) * 100;
          progress.report({
            message: `${progressInfo.current}/${progressInfo.total}: ${title}`,
            increment: increment,
          });
        }, token);

        const embeddingsBuilt = foam.embeddings.size();

        vscode.window.showInformationMessage(
          `✓ Successfully built embeddings for ${embeddingsBuilt} of ${resourceCount} notes`
        );
      } catch (error) {
        // Handle cancellation gracefully
        if (error instanceof CancellationError) {
          vscode.window.showInformationMessage(
            'Embedding build cancelled. You can run the command again to continue where you left off.'
          );
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        vscode.window
          .showErrorMessage(
            `Failed to build embeddings: ${errorMessage}. Ensure Ollama is running and the model is available.`,
            'Retry',
            'Learn More'
          )
          .then(selection => {
            if (selection === 'Retry') {
              vscode.commands.executeCommand(BUILD_EMBEDDINGS_COMMAND.command);
            } else if (selection === 'Learn More') {
              // TODO replace with a proper documentation link in our docs
              vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai'));
            }
          });
      }
    }
  );
}

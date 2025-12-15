import * as vscode from 'vscode';
import { Foam } from '../../../core/model/foam';
import { CancellationError } from '../../../core/services/progress';
import { TaskDeduplicator } from '../../../core/utils/task-deduplicator';
import { FoamWorkspace } from '../../../core/model/workspace';
import { FoamEmbeddings } from '../../../ai/model/embeddings';

export const BUILD_EMBEDDINGS_COMMAND = {
  command: 'foam-vscode.build-embeddings',
  title: 'Foam: Analyze Notes with AI',
};

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  // Deduplicate concurrent executions
  const deduplicator = new TaskDeduplicator<
    'complete' | 'cancelled' | 'error'
  >();

  context.subscriptions.push(
    vscode.commands.registerCommand(
      BUILD_EMBEDDINGS_COMMAND.command,
      async () => {
        return await deduplicator.run(
          () => buildEmbeddings(foam.workspace, foam.embeddings),
          () => {
            vscode.window.showInformationMessage(
              'Note analysis is already in progress - waiting for it to complete'
            );
          }
        );
      }
    )
  );
}

async function buildEmbeddings(
  workspace: FoamWorkspace,
  embeddings: FoamEmbeddings
): Promise<'complete' | 'cancelled' | 'error'> {
  const notesCount = workspace.list().filter(r => r.type === 'note').length;

  if (notesCount === 0) {
    vscode.window.showInformationMessage('No notes found in workspace');
    return 'complete';
  }

  // Show progress notification
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Analyzing notes',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        await embeddings.update(progressInfo => {
          const title = progressInfo.context?.title || 'Processing...';
          const increment = (1 / progressInfo.total) * 100;
          progress.report({
            message: `${progressInfo.current}/${progressInfo.total} - ${title}`,
            increment: increment,
          });
        }, token);

        vscode.window.showInformationMessage(
          `✓ Analyzed ${embeddings.size()} of ${notesCount} notes`
        );
        return 'complete';
      } catch (error) {
        if (error instanceof CancellationError) {
          vscode.window.showInformationMessage(
            'Analysis cancelled. Run the command again to continue where you left off.'
          );
          return 'cancelled';
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        vscode.window.showErrorMessage(
          `Failed to analyze notes: ${errorMessage}`
        );
        return 'error';
      }
    }
  );
}

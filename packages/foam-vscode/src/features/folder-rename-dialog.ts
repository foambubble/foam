import * as vscode from 'vscode';
import { Logger } from '../core/utils/log';
import { pluralize } from '../core/utils';

export interface DryRunCalculationResult {
  edits: vscode.WorkspaceEdit;
  linksUpdatedCount: number;
  filesToEditCount: number; // Number of files with edits
  filesProcessedCount: number; // Total markdown files scanned
  calculationErrors: string[];
}

export interface FolderRenameDialogResult {
  action: 'proceed' | 'skip' | 'cancel' | 'settings' | 'abort';
}

interface FolderRenameQuickPickItem extends vscode.QuickPickItem {
  action: FolderRenameDialogResult['action'];
}

/**
 * Handles the user confirmation dialog for folder renames
 */
export class FolderRenameDialog {
  /**
   * Shows the folder rename confirmation dialog
   */
  static async show(
    fileCount: number,
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    dryRunResult?: DryRunCalculationResult,
    currentMode?: string
  ): Promise<FolderRenameDialogResult> {
    const oldPath = vscode.workspace.asRelativePath(oldUri);
    const newPath = vscode.workspace.asRelativePath(newUri);

    let description = `Renaming folder from '${oldPath}' to '${newPath}'.`;

    if (dryRunResult) {
      if (dryRunResult.calculationErrors.length > 0) {
        description += `\n\n⚠️ Encountered ${pluralize(
          dryRunResult.calculationErrors.length,
          'error'
        )} during link update calculation (see logs).`;
      }
      if (dryRunResult.linksUpdatedCount > 0) {
        description += `\n\nThis will update ${pluralize(
          dryRunResult.linksUpdatedCount,
          'link'
        )} across ${pluralize(
          dryRunResult.filesToEditCount,
          'file'
        )} (out of ${pluralize(
          dryRunResult.filesProcessedCount,
          'markdown file'
        )} in the folder).`;
      } else {
        description += `\n\nNo links appear to need updating in the ${pluralize(
          dryRunResult.filesProcessedCount,
          'markdown file'
        )} found.`;
      }
    } else {
      description += `\n\nThis may update links in ${pluralize(
        fileCount,
        'markdown file'
      )}.`;
    }

    const items: FolderRenameQuickPickItem[] = [];

    // Main action items
    if (dryRunResult && dryRunResult.linksUpdatedCount > 0) {
      items.push({
        label: '$(check) Update Links',
        detail: `Update ${pluralize(
          dryRunResult.linksUpdatedCount,
          'link'
        )} in ${pluralize(
          dryRunResult.filesToEditCount,
          'file'
        )} and proceed with the rename.`,
        action: 'proceed',
      });
    } else {
      items.push({
        label: '$(check) Proceed',
        detail: dryRunResult
          ? `No link updates needed - proceed with the rename (${pluralize(
              dryRunResult.filesProcessedCount,
              'file'
            )} checked).`
          : 'Proceed with the rename.',
        action: 'proceed',
      });
    }

    items.push({
      label: '$(x) Skip Link Updates',
      detail:
        dryRunResult && dryRunResult.linksUpdatedCount > 0
          ? `Rename the folder but leave ${pluralize(
              dryRunResult.linksUpdatedCount,
              'link'
            )} unchanged.`
          : "Rename the folder but don't update any links.",
      action: 'skip',
    });

    items.push({
      label: '$(discard) Abort Rename',
      detail: `Revert the folder name back to '${oldPath}' and cancel the entire operation.`,
      action: 'abort',
    });

    // Add settings option only if currently in "confirm" mode
    if (currentMode === 'confirm') {
      items.push({
        label: '$(gear) Settings',
        detail: 'Change folder rename behavior in Foam settings.',
        action: 'settings',
      });
    }

    const selected = await new Promise<FolderRenameQuickPickItem | undefined>(
      resolve => {
        const quickPick =
          vscode.window.createQuickPick<FolderRenameQuickPickItem>();

        // Enhanced title with dry run results, simplified placeholder
        if (dryRunResult) {
          if (dryRunResult.linksUpdatedCount > 0) {
            quickPick.title = `Foam: Folder Rename - ${pluralize(
              dryRunResult.linksUpdatedCount,
              'link'
            )} to update`;
          } else {
            quickPick.title = `Foam: Folder Rename - No links to update`;
          }
        } else {
          quickPick.title = 'Foam: Folder Rename';
        }

        quickPick.placeholder = 'Choose how to handle this folder rename...';
        quickPick.ignoreFocusOut = true;
        quickPick.matchOnDetail = true;
        quickPick.items = items;

        quickPick.onDidAccept(() => {
          const selection = quickPick.selectedItems[0];
          quickPick.hide();
          resolve(selection);
        });

        quickPick.onDidHide(() => {
          quickPick.dispose();
          resolve(undefined);
        });

        quickPick.show();

        // Force focus to the QuickPick after a short delay
        setTimeout(async () => {
          try {
            // Try to focus the QuickPick directly
            await vscode.commands.executeCommand(
              'workbench.action.focusQuickOpen'
            );
          } catch {
            Logger.debug('Could not force focus to QuickPick dialog');
          }
        }, 50);
      }
    );

    if (!selected) {
      return { action: 'cancel' };
    }

    return { action: selected.action };
  }
}

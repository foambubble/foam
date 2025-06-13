import * as vscode from 'vscode';
import { Logger } from '../core/utils/log';

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

/**
 * Handles the user confirmation dialog for folder renames
 */
export class FolderRenameDialog {
  
  /**
   * Helper function for intelligent pluralization
   */
  public static pluralize(count: number, singular: string, plural?: string): string {
    if (count === 1) {
      return `${count} ${singular}`;
    }
    return `${count} ${plural || singular + 's'}`;
  }

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
        description += `\n\n⚠️ Encountered ${this.pluralize(dryRunResult.calculationErrors.length, 'error')} during link update calculation (see logs).`;
      }
      if (dryRunResult.linksUpdatedCount > 0) {
        description += `\n\nThis will update ${this.pluralize(dryRunResult.linksUpdatedCount, 'link')} across ${this.pluralize(dryRunResult.filesToEditCount, 'file')} (out of ${this.pluralize(dryRunResult.filesProcessedCount, 'markdown file')} in the folder).`;
      } else {
        description += `\n\nNo links appear to need updating in the ${this.pluralize(dryRunResult.filesProcessedCount, 'markdown file')} found.`;
      }
    } else {
      description += `\n\nThis may update links in ${this.pluralize(fileCount, 'markdown file')}.`;
    }

    const items: vscode.QuickPickItem[] = [];

    // Main action items
    if (dryRunResult && dryRunResult.linksUpdatedCount > 0) {
      items.push({
        label: '$(check) Update Links',
        detail: `Update ${this.pluralize(dryRunResult.linksUpdatedCount, 'link')} in ${this.pluralize(dryRunResult.filesToEditCount, 'file')} and proceed with the rename.`
      });
    } else {
      items.push({
        label: '$(check) Proceed',
        detail: dryRunResult ? `No link updates needed - proceed with the rename (${this.pluralize(dryRunResult.filesProcessedCount, 'file')} checked).` : 'Proceed with the rename.'
      });
    }

    items.push({
      label: '$(x) Skip Link Updates',
      detail: dryRunResult && dryRunResult.linksUpdatedCount > 0
        ? `Rename the folder but leave ${this.pluralize(dryRunResult.linksUpdatedCount, 'link')} unchanged.`
        : 'Rename the folder but don\'t update any links.'
    });

    items.push({
      label: '$(discard) Abort Rename',
      detail: `Revert the folder name back to '${oldPath}' and cancel the entire operation.`
    });

    // Add settings option only if currently in "confirm" mode
    if (currentMode === 'confirm') {
      items.push({
        label: '$(gear) Settings',
        detail: 'Change folder rename behavior in Foam settings.'
      });
    }

    const selected = await new Promise<vscode.QuickPickItem | undefined>((resolve) => {
      const quickPick = vscode.window.createQuickPick();

      // Enhanced title with dry run results, simplified placeholder
      if (dryRunResult) {
        if (dryRunResult.linksUpdatedCount > 0) {
          quickPick.title = `Foam: Folder Rename - ${this.pluralize(dryRunResult.linksUpdatedCount, 'link')} to update`;
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
          await vscode.commands.executeCommand('workbench.action.focusQuickOpen');
        } catch {
          Logger.debug('Could not force focus to QuickPick dialog');
        }
      }, 50);
    });

    if (!selected) {
      return { action: 'cancel' };
    }

    if (selected.label.includes('Update Links') || selected.label.includes('Proceed')) {
      return { action: 'proceed' };
    } else if (selected.label.includes('Skip Link Updates')) {
      return { action: 'skip' };
    } else if (selected.label.includes('Settings')) {
      return { action: 'settings' };
    } else if (selected.label.includes('Abort Rename')) {
      return { action: 'abort' };
    } else {
      return { action: 'cancel' };
    }
  }
}

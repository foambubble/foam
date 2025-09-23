import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { TagEdit } from '../../core/services/tag-edit';
import { TagItem } from '../panels/tags-explorer';
import { fromVsCodeUri, toVsCodeWorkspaceEdit } from '../../utils/vsc-utils';
import { Logger } from '../../core/utils/log';
import { Position } from '../../core/model/position';

/**
 * Command definition for the tag rename functionality.
 *
 * This command provides workspace-wide tag renaming capabilities with multiple
 * invocation methods: command palette, context menus, and programmatic calls.
 */
export const RENAME_TAG_COMMAND = {
  /** VS Code command identifier */
  command: 'foam-vscode.rename-tag',
  /** Display name shown in command palette */
  title: 'Foam: Rename Tag',
};

/**
 * Activates the rename tag command feature.
 *
 * Registers the rename tag command with VS Code and sets up error handling.
 * The command supports multiple parameter combinations for different use cases.
 *
 * @param context VS Code extension context for registering disposables
 * @param foamPromise Promise that resolves to the initialized Foam instance
 */
export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      RENAME_TAG_COMMAND.command,
      async (tagLabelOrItem?: string | TagItem, newTagName?: string) => {
        try {
          await executeRenameTag(foam, tagLabelOrItem, newTagName);
        } catch (error) {
          Logger.error('Error executing rename tag command:', error);
          vscode.window.showErrorMessage(
            `Failed to rename tag: ${error.message}`
          );
        }
      }
    )
  );
}

/**
 * Execute the tag rename operation with flexible parameter handling.
 *
 * This function handles the complete tag rename workflow:
 * 1. Determine which tag to rename (from parameters, cursor position, or user selection)
 * 2. Get the new tag name (from parameters or user input)
 * 3. Validate the rename operation
 * 4. Apply the changes across the workspace
 *
 * @param foam The Foam instance containing workspace and tag information
 * @param tagLabelOrItem Optional tag to rename (string label or TagItem from explorer)
 * @param newTagName Optional new name for the tag
 *
 * @example
 * ```typescript
 * // Rename specific tag programmatically
 * await executeRenameTag(foam, 'oldtag', 'newtag');
 *
 * // Interactive rename with tag picker
 * await executeRenameTag(foam);
 *
 * // Rename tag from Tags Explorer context
 * await executeRenameTag(foam, tagItem);
 * ```
 */
async function executeRenameTag(
  foam: Foam,
  tagLabelOrItem?: string | TagItem,
  newTagName?: string
): Promise<void> {
  let tagLabel: string | undefined;

  // Determine the tag to rename
  if (typeof tagLabelOrItem === 'string') {
    tagLabel = tagLabelOrItem;
  } else if (
    tagLabelOrItem &&
    typeof tagLabelOrItem === 'object' &&
    'tag' in tagLabelOrItem
  ) {
    tagLabel = tagLabelOrItem.tag;
  } else {
    // Try to detect tag from current cursor position
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'markdown') {
      const vsPosition = activeEditor.selection.active;
      const fileUri = fromVsCodeUri(activeEditor.document.uri);
      const position = Position.create(vsPosition.line, vsPosition.character);

      tagLabel = TagEdit.getTagAtPosition(foam.tags, fileUri, position);
    }
  }

  // If we still don't have a tag, show picker
  if (!tagLabel) {
    const allTags = Array.from(foam.tags.tags.keys()).sort();

    if (allTags.length === 0) {
      vscode.window.showInformationMessage('No tags found in workspace.');
      return;
    }

    tagLabel = await vscode.window.showQuickPick(allTags, {
      title: 'Select a tag to rename',
      placeHolder: 'Choose a tag to rename...',
    });

    if (!tagLabel) {
      return; // User cancelled
    }
  }

  // Get the new tag name from user or use provided parameter
  let finalNewTagName = newTagName;

  // If newTagName was provided, validate it first
  if (finalNewTagName) {
    const cleanValue = finalNewTagName.startsWith('#')
      ? finalNewTagName.substring(1)
      : finalNewTagName;

    const validation = TagEdit.validateTagRename(
      foam.tags,
      tagLabel!,
      cleanValue
    );
    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    // Handle merge confirmation if needed
    if (validation.isMerge) {
      const confirmed = await vscode.window.showWarningMessage(
        `Tag "${cleanValue}" already exists (${
          validation.targetOccurrences
        } occurrence${
          validation.targetOccurrences !== 1 ? 's' : ''
        }). Merge "${tagLabel}" (${validation.sourceOccurrences} occurrence${
          validation.sourceOccurrences !== 1 ? 's' : ''
        }) into it?`,
        { modal: true },
        'Merge Tags'
      );

      if (confirmed !== 'Merge Tags') {
        throw new Error('Tag merge cancelled by user');
      }
    }
  }

  if (!finalNewTagName) {
    const currentOccurrences = foam.tags.tags.get(tagLabel)?.length ?? 0;
    finalNewTagName = await vscode.window.showInputBox({
      title: `Rename tag "${tagLabel}"`,
      prompt: `Enter new name for tag "${tagLabel}" (${currentOccurrences} occurrence${
        currentOccurrences !== 1 ? 's' : ''
      })`,
      value: tagLabel,
      validateInput: (value: string) => {
        const validation = TagEdit.validateTagRename(
          foam.tags,
          tagLabel!,
          value
        );

        if (!validation.isValid) {
          return validation.message;
        }

        // Show merge information but allow the input
        if (validation.isMerge) {
          return {
            message: `Will merge into existing tag: ${value} - ${
              validation.targetOccurrences
            } occurrence${validation.targetOccurrences !== 1 ? 's' : ''}`,
            severity: vscode.InputBoxValidationSeverity.Info,
          };
        }

        return undefined;
      },
    });

    if (!finalNewTagName) {
      return; // User cancelled
    }
  }

  // Clean the new name
  const cleanNewName = finalNewTagName.startsWith('#')
    ? finalNewTagName.substring(1)
    : finalNewTagName;

  // Final validation and merge confirmation for input box flow
  const finalValidation = TagEdit.validateTagRename(
    foam.tags,
    tagLabel,
    cleanNewName
  );

  if (!finalValidation.isValid) {
    throw new Error(finalValidation.message);
  }

  // Handle merge confirmation if needed (for input box flow)
  if (finalValidation.isMerge) {
    const confirmed = await vscode.window.showWarningMessage(
      `Tag "${cleanNewName}" already exists (${
        finalValidation.targetOccurrences
      } occurrence${
        finalValidation.targetOccurrences !== 1 ? 's' : ''
      }). Merge "${tagLabel}" (${finalValidation.sourceOccurrences} occurrence${
        finalValidation.sourceOccurrences !== 1 ? 's' : ''
      }) into it?`,
      { modal: true },
      'Merge Tags'
    );

    if (confirmed !== 'Merge Tags') {
      return; // User cancelled merge
    }
  }

  // Perform the rename
  await performTagRename(foam, tagLabel, cleanNewName);
}

/**
 * Perform the actual tag rename operation by applying workspace edits.
 *
 * This internal function generates all necessary text edits and applies them
 * to the workspace. It provides user feedback through VS Code notifications
 * and logs the operation results.
 *
 * @param foam The Foam instance containing workspace and tag information
 * @param oldTagLabel The current tag label to be renamed
 * @param newTagLabel The new tag label to rename to
 * @throws Error if workspace edits cannot be applied
 * @internal
 */
async function performTagRename(
  foam: Foam,
  oldTagLabel: string,
  newTagLabel: string
): Promise<void> {
  // Generate all the edits
  const tagEditResult = TagEdit.createRenameTagEdits(
    foam.tags,
    oldTagLabel,
    newTagLabel
  );

  if (tagEditResult.totalOccurrences === 0) {
    vscode.window.showWarningMessage(
      `No occurrences of tag "${oldTagLabel}" found.`
    );
    return;
  }

  // Convert to VS Code WorkspaceEdit
  const workspaceEdit = toVsCodeWorkspaceEdit(
    tagEditResult.edits,
    foam.workspace
  );

  // Apply the edits
  const success = await vscode.workspace.applyEdit(workspaceEdit);

  if (success) {
    // Calculate unique file count from workspace edits
    const uniqueFiles = new Set(
      tagEditResult.edits.map(edit => edit.uri.toString())
    ).size;
    const occurrences = tagEditResult.totalOccurrences;

    Logger.info(
      `Successfully renamed tag "${oldTagLabel}" to "${newTagLabel}" (${occurrences} occurrences across ${uniqueFiles} files)`
    );

    vscode.window.showInformationMessage(
      `Renamed tag "${oldTagLabel}" to "${newTagLabel}" (${occurrences} occurrence${
        occurrences !== 1 ? 's' : ''
      } across ${uniqueFiles} file${uniqueFiles !== 1 ? 's' : ''})`
    );
  } else {
    throw new Error('Failed to apply workspace edits');
  }
}

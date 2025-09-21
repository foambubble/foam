import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { TagEdit } from '../../core/services/tag-edit';
import { TagItem } from '../panels/tags-explorer';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';
import { Logger } from '../../core/utils/log';
import { URI } from '../../core/model/uri';
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
        if (!value || value.trim() === '') {
          return 'Tag name cannot be empty';
        }

        const cleanValue = value.startsWith('#') ? value.substring(1) : value;
        const validation = TagEdit.validateTagRename(
          foam.tags,
          tagLabel!,
          cleanValue
        );

        return validation.isValid ? undefined : validation.message;
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
  const workspaceEdit = new vscode.WorkspaceEdit();

  // Group edits by URI
  const editsByUri = new Map<string, vscode.TextEdit[]>();

  for (const workspaceTextEdit of tagEditResult.edits) {
    const resource = foam.workspace.get(workspaceTextEdit.uri);
    if (!resource) {
      Logger.warn(
        `Could not resolve resource for tag rename: ${workspaceTextEdit.uri.toString()}`
      );
      continue;
    }

    const uriString = resource.uri.toString();
    const existingEdits = editsByUri.get(uriString) || [];

    const vscodeEdit = new vscode.TextEdit(
      toVsCodeRange(workspaceTextEdit.edit.range),
      workspaceTextEdit.edit.newText
    );

    existingEdits.push(vscodeEdit);
    editsByUri.set(uriString, existingEdits);
  }

  // Apply grouped edits to workspace
  for (const [uriString, vscodeEdits] of editsByUri) {
    const resource = foam.workspace.get(URI.parse(uriString, 'file'));
    if (resource) {
      const uri = toVsCodeUri(resource.uri);
      workspaceEdit.set(uri, vscodeEdits);
    }
  }

  // Apply the edits
  const success = await vscode.workspace.applyEdit(workspaceEdit);

  if (success) {
    const files = editsByUri.size;
    const occurrences = tagEditResult.totalOccurrences;

    Logger.info(
      `Successfully renamed tag "${oldTagLabel}" to "${newTagLabel}" (${occurrences} occurrences across ${files} files)`
    );

    vscode.window.showInformationMessage(
      `Renamed tag "${oldTagLabel}" to "${newTagLabel}" (${occurrences} occurrence${
        occurrences !== 1 ? 's' : ''
      } across ${files} file${files !== 1 ? 's' : ''})`
    );
  } else {
    throw new Error('Failed to apply workspace edits');
  }
}

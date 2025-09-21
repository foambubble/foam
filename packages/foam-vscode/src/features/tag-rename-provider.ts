import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { TagEdit } from '../core/services/tag-edit';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeTextEdit,
  toVsCodeUri,
} from '../utils/vsc-utils';
import { Logger } from '../core/utils/log';
import { URI } from '../core/model/uri';
import { Position } from '../core/model/position';

/**
 * Activates the tag rename provider for native F2 rename support.
 *
 * This provider enables users to press F2 on any tag in markdown files
 * to trigger VS Code's built-in rename functionality, providing a native
 * experience for tag renaming that feels like renaming variables in code.
 *
 * @param context VS Code extension context for registering the provider
 * @param foamPromise Promise that resolves to the initialized Foam instance
 */
export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  const provider = new TagRenameProvider(foam);

  context.subscriptions.push(
    vscode.languages.registerRenameProvider('markdown', provider)
  );
}

/**
 * VS Code rename provider for Foam tags.
 *
 * This class implements the VS Code RenameProvider interface to enable
 * native F2 rename support for tags. It provides seamless integration
 * with VS Code's rename system while leveraging Foam's tag infrastructure.
 */
export class TagRenameProvider implements vscode.RenameProvider {
  constructor(private foam: Foam) {}

  /**
   * Prepare a rename operation for VS Code's F2 rename functionality.
   *
   * This method is called when the user presses F2 or invokes "Rename Symbol"
   * from the context menu. It determines if the cursor is positioned on a tag
   * and returns the precise range and placeholder text for the rename operation.
   *
   * @param document The VS Code text document containing the tag
   * @param position The cursor position where F2 was pressed
   * @param token Cancellation token for the operation
   * @returns Range and placeholder for the tag if found, throws error otherwise
   * @throws Error if cursor is not positioned on a tag or tag range cannot be found
   */
  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<
    vscode.Range | { range: vscode.Range; placeholder: string }
  > {
    const fileUri = fromVsCodeUri(document.uri);
    const foamPosition = Position.create(position.line, position.character);
    const tagLabel = TagEdit.getTagAtPosition(
      this.foam.tags,
      fileUri,
      foamPosition
    );

    if (!tagLabel) {
      // Not on a tag, reject the rename
      throw new Error('Cannot rename: cursor is not on a tag');
    }

    // Find the exact range of this tag occurrence
    const tagLocations = this.foam.tags.tags.get(tagLabel) ?? [];
    for (const location of tagLocations) {
      if (location.uri.toString() !== fileUri.toString()) {
        continue;
      }

      const range = location.range;
      const positionInRange =
        (position.line === range.start.line &&
          position.character >= range.start.character &&
          position.line === range.end.line &&
          position.character <= range.end.character) ||
        (position.line > range.start.line && position.line < range.end.line);

      if (positionInRange) {
        return {
          range: toVsCodeRange(range),
          placeholder: tagLabel,
        };
      }
    }

    throw new Error('Cannot rename: tag range not found');
  }

  /**
   * Generate workspace edits to perform the tag rename operation.
   *
   * This method is called after the user enters a new name in the rename dialog.
   * It validates the new name and generates all necessary text edits across the
   * entire workspace to rename every occurrence of the tag consistently.
   *
   * @param document The VS Code text document where rename was initiated
   * @param position The original cursor position where F2 was pressed
   * @param newName The new tag name entered by the user (may include # prefix)
   * @param token Cancellation token for the operation
   * @returns WorkspaceEdit containing all necessary changes across files
   * @throws Error if tag validation fails or rename operation cannot be completed
   */
  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const fileUri = fromVsCodeUri(document.uri);
    const foamPosition = Position.create(position.line, position.character);
    const oldTagLabel = TagEdit.getTagAtPosition(
      this.foam.tags,
      fileUri,
      foamPosition
    );

    if (!oldTagLabel) {
      throw new Error('Cannot rename: cursor is not on a tag');
    }

    // Clean the new name (remove # if user included it)
    const cleanNewName = newName.startsWith('#')
      ? newName.substring(1)
      : newName;

    // Validate the rename
    const validation = TagEdit.validateTagRename(
      this.foam.tags,
      oldTagLabel,
      cleanNewName
    );

    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    try {
      // Generate all the edits
      const tagEditResult = TagEdit.createRenameTagEdits(
        this.foam.tags,
        oldTagLabel,
        cleanNewName
      );

      // Convert to VS Code WorkspaceEdit
      const workspaceEdit = new vscode.WorkspaceEdit();

      // Group edits by URI
      const editsByUri = new Map<string, vscode.TextEdit[]>();

      for (const workspaceTextEdit of tagEditResult.edits) {
        const resource = this.foam.workspace.get(workspaceTextEdit.uri);
        if (!resource) {
          Logger.warn(
            `Could not resolve resource for tag rename: ${workspaceTextEdit.uri.toString()}`
          );
          continue;
        }

        const uriString = resource.uri.toString();
        const existingEdits = editsByUri.get(uriString) || [];

        existingEdits.push(toVsCodeTextEdit(workspaceTextEdit.edit));
        editsByUri.set(uriString, existingEdits);
      }

      // Apply grouped edits to workspace
      for (const [uriString, vscodeEdits] of editsByUri) {
        const resource = this.foam.workspace.get(URI.parse(uriString, 'file'));
        if (resource) {
          const uri = toVsCodeUri(resource.uri);
          workspaceEdit.set(uri, vscodeEdits);
        }
      }

      Logger.info(
        `Renaming tag "${oldTagLabel}" to "${cleanNewName}" (${tagEditResult.totalOccurrences} occurrences)`
      );

      return workspaceEdit;
    } catch (error) {
      Logger.error('Error during tag rename operation:', error);
      throw new Error(`Failed to rename tag: ${error.message}`);
    }
  }
}

import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { Position } from '../core/model/position';
import { Range } from '../core/model/range';
import { Resource } from '../core/model/note';
import { HeadingEdit } from '../core/services/heading-edit';
import { WorkspaceTextEdit } from '../core/services/text-edit';
import { Logger } from '../core/utils/log';
import { fromVsCodeUri, toVsCodeRange, toVsCodeWorkspaceEdit } from '../utils/vsc-utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    vscode.languages.registerRenameProvider(
      'markdown',
      new BlockRenameProvider(foam)
    )
  );
}

export class BlockRenameProvider implements vscode.RenameProvider {
  constructor(private foam: Foam) {}

  async prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<{ range: vscode.Range; placeholder: string }> {
    const info = this.getBlockAnchorAtCursor(document, position);
    if (!info) {
      throw new Error('Cannot rename: cursor is not on a block anchor');
    }
    return {
      range: info.idRange,
      placeholder: info.blockId,
    };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const info = this.getBlockAnchorAtCursor(document, position);
    if (!info) {
      throw new Error('Cannot rename: cursor is not on a block anchor');
    }

    const fileUri = fromVsCodeUri(document.uri);
    const oldId = info.blockId;

    // Edit 1: update the block anchor text in the current document
    const anchorEdit: WorkspaceTextEdit = {
      uri: fileUri,
      edit: {
        range: Range.create(
          position.line,
          info.idRange.start.character,
          position.line,
          info.idRange.end.character
        ),
        newText: newName,
      },
    };

    // Edit 2+: update all links pointing to this block
    const linkEditResult = HeadingEdit.createRenameBlockEdits(
      this.foam.graph,
      this.foam.workspace,
      fileUri,
      oldId,
      newName
    );

    Logger.info(
      `Renaming block "^${oldId}" to "^${newName}" (${linkEditResult.totalOccurrences} link(s) updated)`
    );

    return toVsCodeWorkspaceEdit(
      [anchorEdit, ...linkEditResult.edits],
      this.foam.workspace
    );
  }

  /**
   * If the cursor is within the `markerRange` of a block anchor that exists in
   * the workspace resource, returns the block id and the VS Code range covering
   * only the id text (after the `^`). Returns undefined otherwise.
   */
  private getBlockAnchorAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { blockId: string; idRange: vscode.Range } | undefined {
    const resource = this.foam.workspace.find(fromVsCodeUri(document.uri));
    if (!resource) {
      return undefined;
    }
    const cursorPos = Position.create(position.line, position.character);
    const block = resource.blocks.find(b =>
      Range.containsPosition(b.markerRange, cursorPos)
    );
    if (!block) {
      return undefined;
    }
    // idRange covers only the id text (after the `^`).
    // markerRange.end.character - id.length gives the correct start regardless
    // of whether the marker is inline (" ^id") or own-line ("^id").
    const idStart = block.markerRange.end.character - block.id.length;
    const idRange = toVsCodeRange(
      Range.create(
        block.markerRange.end.line,
        idStart,
        block.markerRange.end.line,
        block.markerRange.end.character
      )
    );
    return { blockId: block.id, idRange };
  }
}

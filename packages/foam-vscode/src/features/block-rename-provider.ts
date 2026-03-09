import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { Resource } from '../core/model/note';
import { Range } from '../core/model/range';
import { HeadingEdit } from '../core/services/heading-edit';
import { WorkspaceTextEdit } from '../core/services/text-edit';
import { Logger } from '../core/utils/log';
import { fromVsCodeUri, toVsCodeWorkspaceEdit } from '../utils/vsc-utils';

/** Matches a block anchor `^id` at the end of a line (ignoring trailing whitespace). */
const BLOCK_ANCHOR_REGEX = /\^([a-zA-Z0-9-]+)\s*$/;

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
   * If the cursor's line ends with a valid block anchor `^id` that exists in
   * the workspace resource, returns the block id and the VS Code range covering
   * only the id text (after the `^`). Returns undefined otherwise.
   */
  private getBlockAnchorAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { blockId: string; idRange: vscode.Range } | undefined {
    const lineText = document.lineAt(position.line).text;
    const match = BLOCK_ANCHOR_REGEX.exec(lineText);
    if (!match) {
      return undefined;
    }

    const blockId = match[1];
    const resource = this.foam.workspace.find(fromVsCodeUri(document.uri));
    if (!resource || !Resource.findBlock(resource, blockId)) {
      return undefined;
    }

    const caretCol = lineText.lastIndexOf('^');
    const idRange = new vscode.Range(
      position.line,
      caretCol + 1,
      position.line,
      caretCol + 1 + blockId.length
    );
    return { blockId, idRange };
  }
}

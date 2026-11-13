import * as vscode from 'vscode';
import { Foam, Logger, MarkdownLink, Position, Range, URI } from '@foam/core';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.languages.registerRenameProvider(
      'markdown',
      new NoteRenameProvider(foam)
    )
  );
}

/**
 * Renames the note a wikilink points at. The edit is the file rename alone:
 * the links are rewritten by whoever listens for it — Foam's own sync for
 * wikilinks, VS Code's `markdown.updateLinksOnFileMove` for markdown links —
 * exactly as they are when the rename starts in the explorer.
 */
export class NoteRenameProvider implements vscode.RenameProvider {
  constructor(private foam: Foam) {}

  async prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<{ range: vscode.Range; placeholder: string }> {
    const target = this.getNoteAtPosition(document, position);
    if (!target) {
      throw new Error('Cannot rename: cursor is not on a note');
    }
    return {
      range: toVsCodeRange(target.range),
      placeholder: document.getText(toVsCodeRange(target.range)),
    };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const target = this.getNoteAtPosition(document, position);
    if (!target) {
      throw new Error('Cannot rename: cursor is not on a note');
    }

    const newUri = target.uri.withName(newName);
    Logger.info(
      `Renaming note "${target.uri.toFsPath()}" to "${newUri.toFsPath()}"`
    );

    const edit = new vscode.WorkspaceEdit();
    edit.renameFile(toVsCodeUri(target.uri), toVsCodeUri(newUri));
    return edit;
  }

  /**
   * The note a wikilink under the cursor points at, with the range of the
   * target text naming it. A link to a note that does not exist has no file
   * to rename, so it reports nothing.
   */
  private getNoteAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { uri: URI; range: Range } | undefined {
    const resource = this.foam.workspace.find(fromVsCodeUri(document.uri));
    if (!resource) {
      return undefined;
    }
    const foamPosition = Position.create(position.line, position.character);
    const link = resource.links.find(l =>
      Range.containsPosition(l.range, foamPosition)
    );
    const range = link && MarkdownLink.getTargetRange(link);
    if (!range || !Range.containsPosition(range, foamPosition)) {
      return undefined;
    }
    const uri = this.foam.workspace.resolveLink(resource, link);
    return uri.isPlaceholder() ? undefined : { uri, range };
  }
}

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
   * name that is this note's to change — the target text less any folder or
   * extension, which belong to the file and not to the new name. A link to a
   * note that does not exist has no file to rename, so it reports nothing.
   */
  private getNoteAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { uri: URI; range: Range } | undefined {
    const uri = fromVsCodeUri(document.uri);
    const known = this.foam.workspace.find(uri);
    if (known?.type !== 'note' || !known.uri.isEqual(uri)) {
      return undefined;
    }
    // Parsed here rather than taken from the workspace, which holds the note
    // as it was last saved and so reports stale ranges while it is edited
    const resource = this.foam.services.parser.parse(uri, document.getText());
    const foamPosition = Position.create(position.line, position.character);
    const link = resource.links.find(l =>
      Range.containsPosition(l.range, foamPosition)
    );
    const range = link && MarkdownLink.getTargetRange(link);
    if (!range || !Range.containsPosition(range, foamPosition)) {
      return undefined;
    }
    const resolved = this.foam.workspace.resolveLink(resource, link);
    if (resolved.isPlaceholder()) {
      return undefined;
    }
    // A section or block the link names belongs to the note, not to the file
    // being renamed, and would otherwise end up in the new path and in every
    // link rewritten to it
    const target = resolved.with({ fragment: '' });
    return { uri: target, range: nameRange(document, range, target) };
  }
}

/**
 * Narrows the target's range to the name of the file it resolves to, so that
 * a folder or an extension the link spells out stays outside the rename box
 * and out of the typed value.
 */
function nameRange(
  document: vscode.TextDocument,
  target: Range,
  uri: URI
): Range {
  const text = document.getText(toVsCodeRange(target));
  const afterFolder = text.lastIndexOf('/') + 1;
  const extension = text.endsWith(uri.getExtension())
    ? uri.getExtension().length
    : 0;
  return Range.create(
    target.start.line,
    target.start.character + afterFolder,
    target.end.line,
    target.end.character - extension
  );
}

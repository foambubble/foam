import * as vscode from 'vscode';
import { Foam, Resource } from '@foam/core';
import { HeadingEdit } from '@foam/core';
import { Logger } from '@foam/core';
import { Position } from '@foam/core';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeWorkspaceEdit,
} from '../../utils/vsc-utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  const provider = new HeadingRenameProvider(foam);

  context.subscriptions.push(
    vscode.languages.registerRenameProvider('markdown', provider)
  );
}

export class HeadingRenameProvider implements vscode.RenameProvider {
  constructor(private foam: Foam) {}

  async prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Range | { range: vscode.Range; placeholder: string }> {
    const found = this.getSectionAtPosition(
      document,
      position,
      this.parseOpenNotes(document)
    );
    if (!found) {
      throw new Error('Cannot rename: cursor is not on a heading');
    }

    return {
      range: toVsCodeRange(found.range),
      placeholder: found.section.label,
    };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const openNotes = this.parseOpenNotes(document);
    const found = this.getSectionAtPosition(document, position, openNotes);
    if (!found) {
      throw new Error('Cannot rename: cursor is not on a heading');
    }
    const { target, section } = found;

    // Edit 1: update the heading text in the note that holds it
    const headingEdit = {
      uri: target.uri,
      edit: { range: section.labelRange, newText: newName },
    };

    // Edit 2+: update all links pointing to this section
    const linkEditResult = HeadingEdit.createRenameSectionEdits(
      this.foam.graph,
      this.foam.workspace,
      target.uri,
      section.label,
      newName,
      openNotes
    );

    const allEdits = [headingEdit, ...linkEditResult.edits];

    Logger.info(
      `Renaming heading "${section.label}" to "${newName}" (${linkEditResult.totalOccurrences} link(s) updated)`
    );

    return toVsCodeWorkspaceEdit(allEdits, this.foam.workspace);
  }

  private getSectionAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
    openNotes: Resource[]
  ) {
    const uri = fromVsCodeUri(document.uri);
    const resource = openNotes.find(r => r.uri.isEqual(uri));
    return (
      resource &&
      HeadingEdit.getSectionAtPosition(
        this.foam.workspace,
        resource,
        Position.create(position.line, position.character),
        openNotes
      )
    );
  }

  /**
   * The workspace's notes that are open in the editor, parsed from their
   * text there: the workspace only has what was last saved.
   */
  private parseOpenNotes(document: vscode.TextDocument): Resource[] {
    const documents = [
      document,
      ...vscode.workspace.textDocuments.filter(
        d => d.uri.toString() !== document.uri.toString()
      ),
    ];
    return documents.flatMap(d => {
      const uri = fromVsCodeUri(d.uri);
      const note = this.foam.workspace.find(uri);
      return note?.type === 'note' && note.uri.isEqual(uri)
        ? [this.foam.services.parser.parse(uri, d.getText())]
        : [];
    });
  }
}

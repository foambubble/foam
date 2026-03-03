import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { Resource, Section } from '../core/model/note';
import { HeadingEdit } from '../core/services/heading-edit';
import { Logger } from '../core/utils/log';
import { Position } from '../core/model/position';
import { Range } from '../core/model/range';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeWorkspaceEdit,
} from '../utils/vsc-utils';

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

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<
    vscode.Range | { range: vscode.Range; placeholder: string }
  > {
    const section = this.getSectionOnHeadingLine(document, position);
    if (!section) {
      throw new Error('Cannot rename: cursor is not on a heading');
    }

    return {
      range: toVsCodeRange(
        getHeadingLabelRange(document, section.range.start.line, section.label)
      ),
      placeholder: section.label,
    };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const section = this.getSectionOnHeadingLine(document, position);
    if (!section) {
      throw new Error('Cannot rename: cursor is not on a heading');
    }

    const fileUri = fromVsCodeUri(document.uri);
    const oldLabel = section.label;

    // Edit 1: update the heading text in the current document
    const headingLabelRange = getHeadingLabelRange(
      document,
      section.range.start.line,
      oldLabel
    );
    const headingEdit = {
      uri: fileUri,
      edit: {
        range: Range.create(
          headingLabelRange.start.line,
          headingLabelRange.start.character,
          headingLabelRange.end.line,
          headingLabelRange.end.character
        ),
        newText: newName,
      },
    };

    // Edit 2+: update all links pointing to this section
    const linkEditResult = HeadingEdit.createRenameSectionEdits(
      this.foam.graph,
      this.foam.workspace,
      fileUri,
      oldLabel,
      newName
    );

    const allEdits = [headingEdit, ...linkEditResult.edits];

    Logger.info(
      `Renaming heading "${oldLabel}" to "${newName}" (${linkEditResult.totalOccurrences} link(s) updated)`
    );

    return toVsCodeWorkspaceEdit(allEdits, this.foam.workspace);
  }

  /**
   * Returns the section at the given position only when the position is on the
   * heading line itself (not in the section body). Uses Resource.getSectionAtPosition
   * to find the enclosing section, then verifies the line matches the heading.
   */
  private getSectionOnHeadingLine(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Section | undefined {
    const resource = this.foam.workspace.find(fromVsCodeUri(document.uri));
    if (!resource) {
      return undefined;
    }
    const foamPosition = Position.create(position.line, position.character);
    const section = Resource.getSectionAtPosition(resource, foamPosition);
    if (!section || section.range.start.line !== position.line) {
      return undefined;
    }
    return section;
  }
}

/**
 * Computes the VS Code range covering just the heading label text (excluding
 * the `#` marks and space prefix) on the given line.
 */
function getHeadingLabelRange(
  document: vscode.TextDocument,
  line: number,
  label: string
): vscode.Range {
  const lineText = document.lineAt(line).text;
  const prefixMatch = /^#{1,6}\s+/.exec(lineText);
  const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
  return new vscode.Range(line, prefixLen, line, prefixLen + label.length);
}

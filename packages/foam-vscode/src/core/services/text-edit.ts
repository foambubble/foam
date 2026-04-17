import detectNewline from 'detect-newline';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { URI } from '../model/uri';

export interface TextEdit {
  range: Range;
  newText: string;
}

export abstract class TextEdit {
  /**
   *
   * @param text text on which the textEdit will be applied
   * @param textEdit
   * @returns {string} text with the applied textEdit
   */
  public static apply(text: string, textEdit: TextEdit): string;
   
  public static apply(text: string, textEdits: TextEdit[]): string;
   
  public static apply(
    text: string,
    textEditOrEdits: TextEdit | TextEdit[]
  ): string {
    if (Array.isArray(textEditOrEdits)) {
      // Apply edits in reverse order (end-to-beginning) to maintain range validity
      // This matches VS Code's behavior for TextEdit application
      const sortedEdits = [...textEditOrEdits].sort((a, b) =>
        Position.compareTo(b.range.start, a.range.start)
      );
      let result = text;
      for (const textEdit of sortedEdits) {
        result = this.apply(result, textEdit);
      }
      return result;
    }

    const textEdit = textEditOrEdits;
    const eol = detectNewline.graceful(text);
    const lines = text.split(eol);
    const characters = text.split('');
    const startOffset = getOffset(lines, textEdit.range.start, eol);
    const endOffset = getOffset(lines, textEdit.range.end, eol);
    const deleteCount = endOffset - startOffset;

    const textToAppend = `${textEdit.newText}`;
    characters.splice(startOffset, deleteCount, textToAppend);
    return characters.join('');
  }
}

const getOffset = (
  lines: string[],
  position: Position,
  eol: string
): number => {
  const eolLen = eol.length;
  let offset = 0;
  let i = 0;
  while (i < position.line && i < lines.length) {
    offset = offset + lines[i].length + eolLen;
    i++;
  }
  return offset + Math.min(position.character, lines[i]?.length ?? 0);
};

/**
 * A text edit with workspace context, combining a URI location with the edit operation.
 *
 * This interface uses composition to pair a text edit with its file location,
 * providing a self-contained unit for workspace-wide text modifications.
 */
export interface WorkspaceTextEdit {
  /** The URI of the file where this edit should be applied */
  uri: URI;
  /** The text edit operation to perform */
  edit: TextEdit;
}

/** A platform-agnostic pointer to a related location, used for hints in lint issues. */
export interface LintRelatedInfo {
  uri: URI;
  range: Range;
  message: string;
}

/**
 * A lint issue found in a note, modelled after ESLint's rule output.
 *
 * Every issue has a code, a human-readable message, and the range in the
 * source file where the problem is. Issues that can be fixed automatically
 * carry a `fix` — an array of workspace edits (may span multiple files).
 * Issues without a `fix` require human judgment to resolve.
 *
 * `relatedInfo` carries optional hints (e.g. candidate targets for an
 * ambiguous link) that a VS Code adapter can surface as DiagnosticRelatedInformation.
 */
export interface LintIssue {
  /** Machine-readable identifier, e.g. 'missing-heading', 'ambiguous-identifier' */
  code: string;
  message: string;
  range: Range;
  /** Present when the issue can be fixed automatically. May touch multiple files. */
  fix?: WorkspaceTextEdit[];
  /** Optional hints pointing to related locations (e.g. candidate targets). */
  relatedInfo?: LintRelatedInfo[];
}

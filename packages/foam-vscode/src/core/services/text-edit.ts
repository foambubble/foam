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
  // eslint-disable-next-line no-dupe-class-members
  public static apply(text: string, textEdits: TextEdit[]): string;
  // eslint-disable-next-line no-dupe-class-members
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

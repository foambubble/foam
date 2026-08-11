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
      // Identical edits collapse to one: several reference links resolving to
      // the same definition legitimately produce copies of the same edit
      const seen = new Set<string>();
      const uniqueEdits = textEditOrEdits.filter(edit => {
        const key = `${Range.toString(edit.range)}|${edit.newText}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      // An edit fully contained in another edit's range is superseded by it:
      // the outer edit rewrites that whole region (e.g. deleting a stale
      // definition inside a block another edit replaces wholesale)
      const independentEdits = uniqueEdits.filter(
        (edit, i) =>
          !uniqueEdits.some(
            (other, j) =>
              j !== i &&
              !Range.isEqual(edit.range, other.range) &&
              Range.containsRange(other.range, edit.range)
          )
      );
      // Apply edits in reverse order (end-to-beginning) to maintain range validity
      // This matches VS Code's behavior for TextEdit application
      const sortedEdits = independentEdits.sort((a, b) =>
        Position.compareTo(b.range.start, a.range.start)
      );
      // Partially overlapping edits would apply on top of each other's output
      // and silently corrupt the document, so they are rejected outright
      for (let i = 0; i < sortedEdits.length - 1; i++) {
        // sorted descending by start: edit i starts at or after edit i+1
        if (
          Position.isBefore(
            sortedEdits[i].range.start,
            sortedEdits[i + 1].range.end
          )
        ) {
          throw new Error(
            `Cannot apply overlapping text edits: ${Range.toString(
              sortedEdits[i + 1].range
            )} overlaps ${Range.toString(sortedEdits[i].range)}`
          );
        }
      }
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

export interface WorkspaceTextEditGroup {
  uri: URI;
  edits: TextEdit[];
}

export abstract class WorkspaceTextEdit {
  /**
   * Drops duplicate edits (same file, same range, same replacement text).
   * Several links can legitimately produce the same edit — e.g. reference
   * links sharing one definition — and applying it twice corrupts the file.
   */
  public static dedupe(edits: WorkspaceTextEdit[]): WorkspaceTextEdit[] {
    const seen = new Set<string>();
    return edits.filter(({ uri, edit }) => {
      const key = `${uri.toString()}|${Range.toString(edit.range)}|${
        edit.newText
      }`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  public static groupByUri(
    edits: WorkspaceTextEdit[]
  ): WorkspaceTextEditGroup[] {
    const groups = new Map<string, WorkspaceTextEditGroup>();

    for (const { uri, edit } of edits) {
      const key = uri.toString();
      const group = groups.get(key);
      if (group) {
        group.edits.push(edit);
      } else {
        groups.set(key, { uri, edits: [edit] });
      }
    }

    return Array.from(groups.values());
  }
}

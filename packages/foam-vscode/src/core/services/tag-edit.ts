import { FoamTags } from '../model/tags';
import { TextEdit } from './text-edit';
import { Location } from '../model/location';
import { Tag } from '../model/note';
import { URI } from '../model/uri';
import { Range } from '../model/range';
import { Position } from '../model/position';

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

/**
 * Result object containing all information needed to perform a tag rename operation.
 *
 * This interface provides structured access to the text edits required to rename
 * a tag across the workspace, along with summary statistics.
 */
export interface TagEditResult {
  /**
   * Array of workspace text edits to perform the tag rename operation.
   *
   * Each edit contains both the file URI and the specific text change needed,
   * making it self-contained and easy to process.
   */
  edits: WorkspaceTextEdit[];

  /**
   * Total number of tag occurrences that will be renamed across all files.
   *
   * This count includes all instances of the tag, whether they appear as
   * hashtags (#tag) or in YAML frontmatter.
   */
  totalOccurrences: number;
}

/**
 * Utility class for performing tag editing operations in Foam workspaces.
 * Provides functionality to rename tags across multiple files while maintaining
 * consistency and data integrity.
 */
export abstract class TagEdit {
  /**
   * Generate text edits to rename a tag across the workspace.
   *
   * This method finds all occurrences of a tag in the workspace and generates
   * the necessary text edits to rename them all consistently. It works with
   * both hashtag format (#tag) and YAML frontmatter format.
   *
   * @param foamTags The FoamTags instance containing all tag locations
   * @param oldTagLabel The current tag label to rename (without # prefix)
   * @param newTagLabel The new tag label (without # prefix)
   * @returns TagEditResult containing all necessary workspace text edits
   */
  public static createRenameTagEdits(
    foamTags: FoamTags,
    oldTagLabel: string,
    newTagLabel: string
  ): TagEditResult {
    const tagLocations = foamTags.tags.get(oldTagLabel) ?? [];
    const workspaceEdits: WorkspaceTextEdit[] = [];

    for (const location of tagLocations) {
      const textEdit = this.createSingleTagEdit(
        location,
        oldTagLabel,
        newTagLabel
      );
      workspaceEdits.push({
        uri: location.uri,
        edit: textEdit,
      });
    }

    return {
      edits: workspaceEdits,
      totalOccurrences: tagLocations.length,
    };
  }

  /**
   * Create a single text edit for a tag location.
   *
   * This internal method generates a TextEdit for a specific tag occurrence.
   * It intelligently determines if the tag is a hashtag (includes #) or a YAML
   * tag (no #) based on the range length and preserves the original format.
   *
   * @param location The location of the tag to rename
   * @param oldTagLabel The current tag label to determine original format
   * @param newTagLabel The new tag label to replace with
   * @returns TextEdit for this specific tag occurrence
   * @internal
   */
  private static createSingleTagEdit(
    location: Location<Tag>,
    oldTagLabel: string,
    newTagLabel: string
  ): TextEdit {
    const range = location.range;
    const rangeLength = range.end.character - range.start.character;

    // If range length is tag label length + 1, it's a hashtag (includes #)
    // If range length equals tag label length, it's a YAML tag (no #)
    const isHashtag = rangeLength === oldTagLabel.length + 1;

    const newText = isHashtag ? `#${newTagLabel}` : newTagLabel;

    return {
      range: location.range,
      newText,
    };
  }

  /**
   * Validate if a tag rename operation is safe and allowed.
   *
   * @param foamTags The FoamTags instance containing current tag information
   * @param oldTagLabel The tag being renamed (must exist in workspace)
   * @param newTagLabel The proposed new tag label (will be cleaned of # prefix)
   * @returns Validation result object with success flag and optional error message
   */
  public static validateTagRename(
    foamTags: FoamTags,
    oldTagLabel: string,
    newTagLabel: string
  ): { isValid: boolean; message?: string } {
    // Check if old tag exists
    if (!foamTags.tags.has(oldTagLabel)) {
      return {
        isValid: false,
        message: `Tag "${oldTagLabel}" does not exist in the workspace.`,
      };
    }

    // Check if new tag label is empty or invalid
    if (!newTagLabel || newTagLabel.trim() === '') {
      return {
        isValid: false,
        message: 'New tag label cannot be empty.',
      };
    }

    // Clean the new tag label (remove # if present)
    const cleanNewLabel = newTagLabel.startsWith('#')
      ? newTagLabel.substring(1)
      : newTagLabel;

    // Check if new tag already exists (case-sensitive)
    if (foamTags.tags.has(cleanNewLabel)) {
      return {
        isValid: false,
        message: `Tag "${cleanNewLabel}" already exists. Choose a different name.`,
      };
    }

    // Check for invalid characters in tag label
    if (cleanNewLabel.includes(' ')) {
      return {
        isValid: false,
        message: 'Tag labels cannot contain spaces.',
      };
    }

    return { isValid: true };
  }

  /**
   * Find the tag at a specific position in a document.
   *
   * This method searches through all known tag locations to find a tag that
   * contains the specified position.
   *
   * @param foamTags The FoamTags instance containing all tag location data
   * @param uri The URI of the file to search in
   * @param position The position in the document (line and character)
   * @returns The tag label if a tag is found at the position, undefined otherwise
   */
  public static getTagAtPosition(
    foamTags: FoamTags,
    uri: URI,
    position: Position
  ): string | undefined {
    // Search through all tags to find one that contains the given position
    for (const [tagLabel, locations] of foamTags.tags) {
      for (const location of locations) {
        if (!location.uri.isEqual(uri)) {
          continue;
        }
        if (Range.containsPosition(location.range, position)) {
          return tagLabel;
        }
      }
    }

    return undefined;
  }
}

import { FoamTags } from '../model/tags';
import { TextEdit, WorkspaceTextEdit } from './text-edit';
import { Location } from '../model/location';
import { Tag } from '../model/note';
import { URI } from '../model/uri';
import { Range } from '../model/range';
import { Position } from '../model/position';
import { WORD_REGEX } from '../utils/hashtags';

/**
 * Result object containing all information needed to perform a tag rename operation.
 */
export interface TagEditResult {
  /**
   * Array of workspace text edits to perform the tag rename operation.
   */
  edits: WorkspaceTextEdit[];

  /**
   * Total number of tag occurrences that will be renamed across all files.
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
   * @param location The location of the tag to rename
   * @param oldTagLabel The current tag label to determine original format
   * @param newTagLabel The new tag label to replace with
   * @returns TextEdit for this specific tag occurrence
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
   * @returns Validation result with merge information and statistics
   */
  public static validateTagRename(
    foamTags: FoamTags,
    oldTagLabel: string,
    newTagLabel: string
  ): {
    isValid: boolean;
    isMerge: boolean;
    sourceOccurrences: number;
    targetOccurrences: number;
    message?: string;
  } {
    const sourceOccurrences = foamTags.tags.get(oldTagLabel)?.length ?? 0;

    // Check if old tag exists
    if (!foamTags.tags.has(oldTagLabel)) {
      return {
        isValid: false,
        isMerge: false,
        sourceOccurrences: 0,
        targetOccurrences: 0,
        message: `Tag "${oldTagLabel}" does not exist in the workspace.`,
      };
    }

    // Clean the new tag label (remove # if present)
    const cleanNewLabel = newTagLabel?.startsWith('#')
      ? newTagLabel.substring(1)
      : newTagLabel;

    // Check if new tag label is empty or invalid
    if (!cleanNewLabel || cleanNewLabel.trim() === '') {
      return {
        isValid: false,
        isMerge: false,
        sourceOccurrences,
        targetOccurrences: 0,
        message: 'New tag label cannot be empty.',
      };
    }

    // Check for invalid characters in tag label
    const match = cleanNewLabel.match(WORD_REGEX);
    if (!match || match[0] !== cleanNewLabel) {
      return {
        isValid: false,
        isMerge: false,
        sourceOccurrences,
        targetOccurrences: 0,
        message: 'Invalid tag label.',
      };
    }

    // Check if renaming to same tag (no-op)
    if (cleanNewLabel === oldTagLabel) {
      return {
        isValid: false,
        isMerge: false,
        sourceOccurrences,
        targetOccurrences: sourceOccurrences,
        message: 'New tag name is the same as the current name.',
      };
    }

    const targetOccurrences = foamTags.tags.get(cleanNewLabel)?.length ?? 0;
    const isMerge = foamTags.tags.has(cleanNewLabel);

    return {
      isValid: true,
      isMerge: isMerge,
      sourceOccurrences,
      targetOccurrences,
      message: isMerge
        ? `This will merge "${oldTagLabel}" (${sourceOccurrences} occurrence${
            sourceOccurrences !== 1 ? 's' : ''
          }) into "${cleanNewLabel}" (${targetOccurrences} occurrence${
            targetOccurrences !== 1 ? 's' : ''
          })`
        : undefined,
    };
  }

  /**
   * Find all child tags for a given parent tag.
   *
   * This method searches for tags that start with the parent tag followed by
   * a forward slash, indicating they are hierarchical children.
   *
   * @param foamTags The FoamTags instance containing all tag information
   * @param parentTag The parent tag to find children for (e.g., "project")
   * @returns Array of child tag labels (e.g., ["project/frontend", "project/backend"])
   */
  public static findChildTags(foamTags: FoamTags, parentTag: string): string[] {
    const childTags: string[] = [];
    const parentPrefix = parentTag + '/';

    for (const [tagLabel] of foamTags.tags) {
      if (tagLabel.startsWith(parentPrefix)) {
        childTags.push(tagLabel);
      }
    }

    return childTags.sort();
  }

  /**
   * Create text edits to rename a parent tag and all its children hierarchically.
   *
   * This method performs a comprehensive rename operation that updates both
   * the parent tag and all child tags, maintaining the hierarchical structure
   * with the new parent name.
   *
   * @param foamTags The FoamTags instance containing all tag locations
   * @param oldParentTag The current parent tag label (without # prefix)
   * @param newParentTag The new parent tag label (without # prefix)
   * @returns TagEditResult containing all necessary workspace text edits
   */
  public static createHierarchicalRenameEdits(
    foamTags: FoamTags,
    oldParentTag: string,
    newParentTag: string
  ): TagEditResult {
    const allEdits: WorkspaceTextEdit[] = [];
    let totalOccurrences = 0;

    // Rename the parent tag itself
    const parentResult = this.createRenameTagEdits(
      foamTags,
      oldParentTag,
      newParentTag
    );
    allEdits.push(...parentResult.edits);
    totalOccurrences += parentResult.totalOccurrences;

    // Find and rename all child tags
    const childTags = this.findChildTags(foamTags, oldParentTag);
    for (const childTag of childTags) {
      // Replace the parent portion with the new parent name
      const newChildTag = childTag.replace(
        oldParentTag + '/',
        newParentTag + '/'
      );
      const childResult = this.createRenameTagEdits(
        foamTags,
        childTag,
        newChildTag
      );
      allEdits.push(...childResult.edits);
      totalOccurrences += childResult.totalOccurrences;
    }

    return {
      edits: allEdits,
      totalOccurrences,
    };
  }

  /**
   * Find the tag at a specific position in a document.
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

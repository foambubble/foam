import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { TagItem } from '../panels/tags-explorer';

export const SEARCH_TAG_COMMAND = {
  command: 'foam-vscode.search-tag',
  title: 'Foam: Search Tag',
};

/**
 * Generates a regex search pattern that matches both inline tags (#tag) and YAML front matter tags.
 *
 * @param tagLabel The tag label to search for (without # prefix)
 * @returns A regex pattern string that matches the tag in both formats
 */
export function generateTagSearchPattern(tagLabel: string): string {
  // Escape special regex characters in tag label
  const escapedTag = tagLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Pattern matches three cases:
  // 1. #tag - inline hashtags with word boundary
  // 2. tags: [...tag...] - YAML front matter array format
  // 3. ^\s*-\s+tag\s*$ - YAML front matter list format (tag is the only content after dash)
  return `#${escapedTag}\\b|tags:.*?\\b${escapedTag}\\b|^\\s*-\\s+${escapedTag}\\b\\s*$`;
}

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      SEARCH_TAG_COMMAND.command,
      async (tagLabelOrItem?: string | TagItem) => {
        let tagLabel: string | undefined;

        // Handle both string and TagItem parameters
        if (typeof tagLabelOrItem === 'string') {
          tagLabel = tagLabelOrItem;
        } else if (
          tagLabelOrItem &&
          typeof tagLabelOrItem === 'object' &&
          'tag' in tagLabelOrItem
        ) {
          tagLabel = tagLabelOrItem.tag;
        }

        if (!tagLabel) {
          // If no tag provided, show tag picker
          const allTags = Array.from(foam.tags.tags.keys()).sort();
          if (allTags.length === 0) {
            vscode.window.showInformationMessage('No tags found in workspace.');
            return;
          }

          tagLabel = await vscode.window.showQuickPick(allTags, {
            title: 'Select a tag to search',
            placeHolder: 'Choose a tag to search for...',
          });

          if (!tagLabel) {
            return; // User cancelled
          }
        }

        // Generate search pattern that matches both inline and YAML tags
        const searchPattern = generateTagSearchPattern(tagLabel);

        await vscode.commands.executeCommand('workbench.action.findInFiles', {
          query: searchPattern,
          triggerSearch: true,
          matchWholeWord: false,
          isCaseSensitive: true,
          isRegex: true,
        });
      }
    )
  );
}

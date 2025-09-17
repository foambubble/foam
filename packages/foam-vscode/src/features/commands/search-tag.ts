import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { TagItem } from '../panels/tags-explorer';

export const SEARCH_TAG_COMMAND = {
  command: 'foam-vscode.search-tag',
  title: 'Foam: Search Tag',
};

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
        } else if (tagLabelOrItem && typeof tagLabelOrItem === 'object' && 'tag' in tagLabelOrItem) {
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

        // Use VS Code's built-in search with the tag pattern
        const searchQuery = `#${tagLabel}`;

        await vscode.commands.executeCommand('workbench.action.findInFiles', {
          query: searchQuery,
          triggerSearch: true,
          matchWholeWord: false,
          isCaseSensitive: true,
        });
      }
    )
  );
}
import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamTags } from '../core/model/tags';
import { FoamFeature } from '../types';
import { isInFrontMatter, isOnYAMLKeywordLine, mdDocSelector } from '../utils';

// this regex is different from HASHTAG_REGEX in that it does not look for a
// #+character. It uses a negative look-ahead for `# `
const HASH_REGEX =
  /(?<=^|\s)#(?![ \t#])([0-9]*[\p{L}\p{Emoji_Presentation}\p{N}/_-]*)/dgu;
const FRONT_MATTER_PREVIOUS_CHARACTER = /[#[\s\w]/g;

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        mdDocSelector,
        new TagCompletionProvider(foam.tags),
        '#'
      )
    );
  },
};

export class TagCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem>
{
  constructor(private foamTags: FoamTags) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    const beginningOfFileText = document.getText(
      new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(
          position.line < 50 ? position.line : 50,
          position.character
        )
      )
    );

    const requiresAutocomplete = cursorPrefix.match(HASH_REGEX);
    const isHashMatch = requiresAutocomplete !== null;
    const isTagsMatch =
      isOnYAMLKeywordLine(beginningOfFileText, 'tags') &&
      cursorPrefix
        .charAt(position.character - 1)
        .match(FRONT_MATTER_PREVIOUS_CHARACTER);
    const inFrontMatter = isInFrontMatter(beginningOfFileText, position.line);

    if (!isHashMatch && !inFrontMatter) {
      return null;
    }
    if (inFrontMatter && !isTagsMatch) {
      return null;
    }

    let lastMatchStartIndex = -1;
    if (isHashMatch) {
      // check the match group length.
      // find the last match group, and ensure the end of that group is
      // at the cursor position.
      // This excludes both `#%` and also `here is #my-app1 and now # ` with
      // trailing space
      const matches = Array.from(cursorPrefix.matchAll(HASH_REGEX));
      const lastMatch = matches[matches.length - 1];
      lastMatchStartIndex = lastMatch.index;
      const lastMatchEndIndex = lastMatch[0].length + lastMatchStartIndex;
      if (lastMatchEndIndex !== position.character) {
        return null;
      }
    }

    const completionTags = [];
    [...this.foamTags.tags].forEach(([tag]) => {
      const item = new vscode.CompletionItem(
        tag,
        vscode.CompletionItemKind.Text
      );

      // if we are in the front matter and we typed #, remove the `#`
      if (isHashMatch && inFrontMatter) {
        item.additionalTextEdits = [
          vscode.TextEdit.delete(
            new vscode.Range(
              position.line,
              lastMatchStartIndex,
              position.line,
              lastMatchStartIndex + 1
            )
          ),
        ];
      }
      item.insertText = `${tag}`;
      item.documentation = tag;

      completionTags.push(item);
    });

    return new vscode.CompletionList(completionTags);
  }
}

export default feature;

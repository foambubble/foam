import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamTags } from '../core/model/tags';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';

// this regex is different from HASHTAG_REGEX in that it does not look for a
// #+character. It uses a negative look-ahead for `# `
const TAG_REGEX =
  /(?<=^|\s)#(?![ \t#])([0-9]*[\p{L}\p{Emoji_Presentation}\p{N}/_-]*)/gu;

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

    const requiresAutocomplete = cursorPrefix.match(TAG_REGEX);

    if (!requiresAutocomplete) {
      return null;
    }

    // check the match group length.
    // if the match is only '#', the character to the left of cursor should
    // also be `#`. If it isn't, we didn't match the
    // `[0-9]*[\p{L}\p{Emoji_Presentation}\p{N}/_-]` group
    // This excludes things like `#&`
    const matchText = requiresAutocomplete[requiresAutocomplete.length - 1];
    if (
      matchText === '#' &&
      cursorPrefix.charAt(position.character - 1) !== '#'
    ) {
      return null;
    }

    const completionTags = [];
    [...this.foamTags.tags].forEach(([tag]) => {
      const item = new vscode.CompletionItem(
        tag,
        vscode.CompletionItemKind.Text
      );

      item.insertText = `${tag}`;
      item.documentation = tag;

      completionTags.push(item);
    });

    return new vscode.CompletionList(completionTags);
  }
}

export default feature;

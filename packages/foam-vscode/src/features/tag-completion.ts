import { EOL } from 'os';
import * as vscode from 'vscode';
import matter from 'gray-matter';
import { Foam } from '../core/model/foam';
import { FoamTags } from '../core/model/tags';
import { HASHTAG_REGEX } from '../core/utils/hashtags';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';

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

    const requiresAutocomplete =
      cursorPrefix.match(HASHTAG_REGEX) ||
      this.isInTagsFrontMatter(document, position);

    if (!requiresAutocomplete) {
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

  isInTagsFrontMatter(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Boolean {
    const FRONT_MATTER_TAG_REGEX =
      /^\s*tags:\s+.*?\s{0,1}?([0-9]*[\p{L}\p{Emoji_Presentation}/_-][\p{L}\p{Emoji_Presentation}\p{N}/_-]*)$/gmu;

    const fm = matter(document.getText());
    if ('tags' in fm.data) {
      const cursorPrefix = document
        .lineAt(position)
        .text.substr(0, position.character);

      // need to ensure that the position is within the front matter
      const contentStartLine = fm.matter.split(EOL).length;
      if (position.line >= contentStartLine) {
        return false;
      }

      return cursorPrefix.match(FRONT_MATTER_TAG_REGEX) != null;
    }
    return false;
  }
}

export default feature;

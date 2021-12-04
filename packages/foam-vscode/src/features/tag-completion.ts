import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamTags } from '../core/model/tags';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { SECTION_REGEX } from './link-completion';

export const TAG_REGEX = /#(.*)/;

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
  implements vscode.CompletionItemProvider<vscode.CompletionItem> {
  constructor(private foamTags: FoamTags) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    const requiresAutocomplete =
      cursorPrefix.match(TAG_REGEX) && !cursorPrefix.match(SECTION_REGEX);

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
}

export default feature;

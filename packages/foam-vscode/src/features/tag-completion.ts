import { Foam, FoamGraph, FoamWorkspace } from 'foam-core';
import * as vscode from 'vscode';
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
        new TagCompletionProvider(foam.workspace, foam.graph),
        '#'
      )
    );
  },
};

export class TagCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem> {
  constructor(private ws: FoamWorkspace, private graph: FoamGraph) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    // eslint-disable-next-line no-useless-escape
    const requiresAutocomplete = cursorPrefix.match(/#(.*)/);

    if (!requiresAutocomplete) {
      return null;
    }

    const allTags = [];
    this.ws.list().forEach(resource => {
      allTags.push(...resource.tags);
    });

    const completionTags = [];
    [...new Set(allTags)].forEach(tag => {
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

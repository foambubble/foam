import * as vscode from 'vscode';
import { Foam, FoamWorkspace, uris } from 'foam-core';
import { FoamFeature } from '../types';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        'markdown',
        new CompletionProvider(foam.workspace),
        '['
      )
    );
  },
};

class CompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem> {
  constructor(private ws: FoamWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    const requiresAutocomplete = cursorPrefix.match(/\[\[([^\[\]]*?)/);

    if (!requiresAutocomplete) {
      return null;
    }

    const results = this.ws
      .list()
      .map(r => uris.getBasename(r.uri))
      .map(
        name => new vscode.CompletionItem(name, vscode.CompletionItemKind.File)
      );

    return new vscode.CompletionList(results);
  }
}

export default feature;

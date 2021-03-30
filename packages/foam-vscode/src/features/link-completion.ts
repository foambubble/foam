import * as vscode from 'vscode';
import { Foam, FoamWorkspace, uris, isNote } from 'foam-core';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector } from '../utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        mdDocSelector,
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

    const results = this.ws.list().map(resource => {
      const uri = resource.uri;
      if (uris.isPlaceholder(uri)) {
        return new vscode.CompletionItem(
          uri.path,
          vscode.CompletionItemKind.Interface
        );
      }

      const item = new vscode.CompletionItem(
        vscode.workspace.asRelativePath(resource.uri),
        vscode.CompletionItemKind.File
      );
      item.insertText = uris.getBasename(resource.uri);
      item.documentation =
        isNote(resource) && getNoteTooltip(resource.source.text);

      return item;
    });

    return new vscode.CompletionList(results);
  }
}

export default feature;

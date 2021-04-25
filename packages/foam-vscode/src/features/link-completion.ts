import * as vscode from 'vscode';
import { Foam, FoamWorkspace, URI, FoamGraph } from 'foam-core';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector } from '../utils';
import { toVsCodeUri } from '../utils/vsc-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        mdDocSelector,
        new CompletionProvider(foam.workspace, foam.graph),
        '['
      )
    );
  },
};

export class CompletionProvider
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
    const requiresAutocomplete = cursorPrefix.match(/\[\[[^\[\]]*(?!.*\]\])/);

    if (!requiresAutocomplete) {
      return null;
    }

    const resources = this.ws.list().map(resource => {
      const item = new vscode.CompletionItem(
        vscode.workspace.asRelativePath(toVsCodeUri(resource.uri)),
        vscode.CompletionItemKind.File
      );
      item.insertText = URI.getBasename(resource.uri);
      item.documentation = getNoteTooltip(resource.source.text);

      return item;
    });

    const placeholders = Object.values(this.graph.placeholders).map(uri => {
      return new vscode.CompletionItem(
        uri.path,
        vscode.CompletionItemKind.Interface
      );
    });

    return new vscode.CompletionList([...resources, ...placeholders]);
  }
}

export default feature;

import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { FoamTags } from '@foam/core';
import { completionAt } from '@foam/core';
import { getFoamDocSelectors } from '../../services/editor';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      getFoamDocSelectors(),
      new TagCompletionProvider(foam.tags),
      '#'
    )
  );
}

export class TagCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem>
{
  constructor(private foamTags: FoamTags) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const context = completionAt(text, offset);
    if (context?.kind !== 'tag') {
      return null;
    }

    const completionTags = this.createCompletionTagItems();
    // In the front matter a `#` starts a YAML comment, so a typed one goes
    const typed = text.slice(context.start, offset);
    if (context.frontmatter && typed.startsWith('#')) {
      const hash = new vscode.Range(
        document.positionAt(context.start),
        document.positionAt(context.start + 1)
      );
      completionTags.forEach(item => {
        item.additionalTextEdits = [vscode.TextEdit.delete(hash)];
      });
    }

    return new vscode.CompletionList(completionTags);
  }

  private createCompletionTagItems(): vscode.CompletionItem[] {
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
    return completionTags;
  }
}

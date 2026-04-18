import { ExtensionContext, languages } from 'vscode';
import {
  fixedSnippetsProvider,
  relativeSnippetsProvider,
} from './completion-provider';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      'markdown',
      fixedSnippetsProvider,
      '/'
    ),
    languages.registerCompletionItemProvider(
      'markdown',
      relativeSnippetsProvider,
      '/'
    )
  );
}

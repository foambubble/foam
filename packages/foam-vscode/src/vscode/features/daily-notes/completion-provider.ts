import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  CompletionList,
  CompletionTriggerKind,
} from 'vscode';
import { getFoamVsCodeConfig } from '../../../vscode/config';
import {
  DailyNoteSnippet,
  getDayOfWeekSnippets,
  getFixedSnippets,
  getRelativeSnippet,
} from '../../../daily-note/daily-note-snippets';
import { getDailyNoteLink } from './daily-note-service';

const RELATIVE_UNITS: Array<'d' | 'w' | 'm' | 'y'> = ['d', 'w', 'm', 'y'];

function makeCompletionItem(
  snippet: DailyNoteSnippet,
  afterCompletion: string
): CompletionItem {
  const link = getDailyNoteLink(snippet.date);
  const item = new CompletionItem(snippet.trigger, CompletionItemKind.Snippet);
  item.insertText = link;
  item.detail = `${link} - ${snippet.description}`;
  if (afterCompletion !== 'noop') {
    item.command = {
      command: 'foam-vscode.open-dated-note',
      title: 'Open a note for the given date',
      arguments: [snippet.date],
    };
  }
  return item;
}

export const fixedSnippetsProvider: CompletionItemProvider = {
  provideCompletionItems: (document, position, _token, context) => {
    if (context.triggerKind === CompletionTriggerKind.Invoke) {
      // Return [] to fall back to VS Code's word-based suggestions when
      // completion is triggered without the trigger character.
      // See https://github.com/foambubble/foam/pull/417
      return [];
    }
    const afterCompletion = getFoamVsCodeConfig(
      'dateSnippets.afterCompletion',
      'createNote'
    );
    const today = new Date();
    const range = document.getWordRangeAtPosition(position, /\S+/);
    const snippets = [
      ...getFixedSnippets(today),
      ...getDayOfWeekSnippets(today),
    ];
    return snippets.map(s => {
      const item = makeCompletionItem(s, afterCompletion);
      item.range = range;
      return item;
    });
  },
};

export const relativeSnippetsProvider: CompletionItemProvider = {
  provideCompletionItems: (document, position, _token, context) => {
    if (context.triggerKind === CompletionTriggerKind.Invoke) {
      return [];
    }
    const afterCompletion = getFoamVsCodeConfig(
      'dateSnippets.afterCompletion',
      'createNote'
    );
    const today = new Date();
    const range = document.getWordRangeAtPosition(position, /\S+/);
    const snippetString = document.getText(range);
    const matches = snippetString.match(/(\d+)/);
    const n = matches ? parseInt(matches[0]) : 1;
    const items = RELATIVE_UNITS.map(unit => {
      const item = makeCompletionItem(
        getRelativeSnippet(today, unit, n),
        afterCompletion
      );
      item.range = range;
      return item;
    });
    // Keep the list incomplete so the user can refine the number
    return new CompletionList(items, true);
  },
};

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
import { getDailyNoteLinks } from './daily-note-service';

const RELATIVE_UNITS: Array<'d' | 'w' | 'm' | 'y'> = ['d', 'w', 'm', 'y'];

async function makeCompletionItems(
  snippets: DailyNoteSnippet[],
  afterCompletion: string
): Promise<CompletionItem[]> {
  const links = await getDailyNoteLinks(snippets.map(s => s.date));
  return snippets.map((snippet, i) =>
    makeCompletionItem(snippet, links[i], afterCompletion)
  );
}

function makeCompletionItem(
  snippet: DailyNoteSnippet,
  link: string,
  afterCompletion: string
): CompletionItem {
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
  provideCompletionItems: async (document, position, _token, context) => {
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
    const items = await makeCompletionItems(snippets, afterCompletion);
    for (const item of items) {
      item.range = range;
    }
    return items;
  },
};

export const relativeSnippetsProvider: CompletionItemProvider = {
  provideCompletionItems: async (document, position, _token, context) => {
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
    const items = await makeCompletionItems(
      RELATIVE_UNITS.map(unit => getRelativeSnippet(today, unit, n)),
      afterCompletion
    );
    for (const item of items) {
      item.range = range;
    }
    // Keep the list incomplete so the user can refine the number
    return new CompletionList(items, true);
  },
};

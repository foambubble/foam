import {
  workspace,
  ExtensionContext,
  commands,
  languages,
  CompletionItemProvider,
  CompletionItem,
  CompletionItemKind,
  CompletionList
} from "vscode";
import { getDailyNoteFileName, openDailyNoteFor } from "../dated-notes";
import { LinkReferenceDefinitionsSetting } from "../settings";
import { FoamFeature } from "../types";

interface DateSnippet {
  snippet: string;
  date: Date;
  detail: string;
}

const foamConfig = workspace.getConfiguration("foam");

const getDailyNoteLink = (
  date: Date,
  extension: string,
  linkReferenceDefinitions: LinkReferenceDefinitionsSetting
) => {
  let name = getDailyNoteFileName(foamConfig, date);
  if (
    linkReferenceDefinitions ===
    LinkReferenceDefinitionsSetting.withoutExtensions
  ) {
    name = name.replace(`.${extension}`, "");
  }
  return `[[${name}]]`;
};

const snippets: (() => DateSnippet)[] = [
  () => ({
    detail: "Insert a link to today's daily note",
    snippet: "/day",
    date: new Date()
  }),
  () => {
    const today = new Date();
    return {
      detail: "Insert a link to tomorrow's daily note",
      snippet: "/tomorrow",
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    };
  }
];

/**
 * I think to start working with this you should take a look at emmet
 * https://github.com/Microsoft/vscode/tree/master/extensions/emmet
 * Also, snippet string: https://code.visualstudio.com/api/references/vscode-api#SnippetString
 */
const computedSnippets: ((number: number) => DateSnippet)[] = [
  (days: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${days} day(s) from now`,
      snippet: `/+${days}d`,
      date: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + days
      )
    };
  },
  (weeks: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${weeks} week(s) from now`,
      snippet: `/+${weeks}w`,
      date: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 7 * weeks
      )
    };
  },
  (years: number) => {
    const today = new Date();
    return {
      detail: `Insert a date ${years} year(s) from now`,
      snippet: `/+${years}y`,
      date: new Date(
        today.getFullYear() + years,
        today.getMonth(),
        today.getDate()
      )
    };
  }
];

const completions: CompletionItemProvider = {
  provideCompletionItems: (_document, _position, _token, _context) => {
    const completionItems = snippets.map(item => {
      const { snippet, date, detail } = item();
      const completionItem = new CompletionItem(
        snippet,
        CompletionItemKind.Snippet
      );
      completionItem.insertText = getDailyNoteLink(
        date,
        foamConfig.get("openDailyNote.fileExtension"),
        foamConfig.get("edit.linkReferenceDefinitions")
      );
      completionItem.command = {
        command: "foam-vscode.open-dated-note",
        title: "Open a note for the given date",
        arguments: [date]
      };
      return completionItem;
    });
    return completionItems;
  }
};

const computedCompletions: CompletionItemProvider = {
  provideCompletionItems: (document, position, token, context) => {
    return new Promise((resolve, reject) => {
      document.offsetAt(position);
      const range = document.getWordRangeAtPosition(position);
      const snippetString = document.getText(range);
      const matches = snippetString.match(/(\d+)/);
      const number = matches ? matches[0] : undefined;
      if (number === undefined) {
        return resolve(
          new CompletionList(
            [new CompletionItem(snippetString, CompletionItemKind.Snippet)],
            true
          )
        );
      }
      const completionItems = computedSnippets.map(item => {
        const { snippet, detail, date } = item(parseInt(number));
        const completionItem = new CompletionItem(
          snippet,
          CompletionItemKind.Snippet
        );
        completionItem.range = range;
        completionItem.insertText = getDailyNoteLink(
          date,
          foamConfig.get("openDailyNote.fileExtension"),
          foamConfig.get("edit.linkReferenceDefinitions")
        );
        completionItem.detail = `${completionItem.insertText} - ${detail}`;
        completionItem.command = {
          command: "foam-vscode.open-dated-note",
          title: "Open a note for the given date",
          arguments: [date]
        };
        return completionItem;
      });
      return resolve(
        new CompletionList(
          [
            new CompletionItem("/+", CompletionItemKind.Snippet),
            ...completionItems
          ],
          true
        )
      );
    });
  }
};

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-dated-note", date =>
        openDailyNoteFor(date)
      )
    );
    languages.registerCompletionItemProvider("markdown", completions, "/");
    languages.registerCompletionItemProvider(
      "markdown",
      computedCompletions,
      "/"
    );
  }
};

export default feature;

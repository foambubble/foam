import {
  workspace,
  ExtensionContext,
  commands,
  languages,
  CompletionItemProvider,
  CompletionItem,
  CompletionItemKind
} from "vscode";
import { getDailyNoteFileName, openDatedNote } from "../dated-notes";
import { FoamFeature } from "../types";

interface DateSnippet {
  snippet: string;
  date: Date;
  detail: string;
}
const foamConfig = workspace.getConfiguration("foam");
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

const completions: CompletionItemProvider = {
  provideCompletionItems: (document, position, token, context) => {
    const completionItems = snippets.map(snippet => {
      const completionItem = new CompletionItem(
        snippet().snippet,
        CompletionItemKind.Snippet
      );
      completionItem.insertText = `[[${getDailyNoteFileName(
        foamConfig,
        snippet().date
      )}]]`;
      completionItem.command = {
        command: "foam-vscode.open-dated-note",
        title: "Open a note for the given date",
        arguments: [snippet().date]
      };
      return completionItem;
    });
    return completionItems;
  }
};

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-dated-note", date =>
        openDatedNote(date)
      )
    );
    languages.registerCompletionItemProvider("markdown", completions, "/");
  }
};

export default feature;

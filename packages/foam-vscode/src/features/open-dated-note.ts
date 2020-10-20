import {
  window,
  workspace,
  Uri,
  WorkspaceConfiguration,
  ExtensionContext,
  commands,
  Selection,
  languages,
  CompletionItemProvider,
  CompletionItem,
  CompletionItemKind
} from "vscode";
import { dirname, join } from "path";
import dateFormat from "dateformat";
import * as fs from "fs";
import { FoamFeature } from "../types";
import { docConfig } from "../utils";

const completion: CompletionItemProvider = {
  provideCompletionItems: (document, position, token, context) => {
    const today = new Date();
    const tomorrow = new CompletionItem(
      "/tomorrow",
      CompletionItemKind.Snippet
    );
    tomorrow.insertText = `[[${getDailyNoteFileName(
      workspace.getConfiguration("foam"),
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    )}]]`;
    tomorrow.command = {
      command: "foam-vscode.open-dated-note",
      title: "Open a note for the given date",
      arguments: [
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      ]
    };
    return [tomorrow];
  }
};

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-dated-note", date =>
        openDatedNote(date)
      )
    );
    languages.registerCompletionItemProvider(
      "markdown",
      completion,
      "/",
      "/today",
      "/tomorrow"
    );
  }
};

async function openDatedNote(date: Date) {
  const foamConfiguration = workspace.getConfiguration("foam");
  const currentDate = date ? date : new Date();

  const dailyNotePath = getDailyNotePath(foamConfiguration, currentDate);

  const isNew = await createDailyNoteIfNotExists(
    foamConfiguration,
    dailyNotePath,
    currentDate
  );
  await focusDailyNote(dailyNotePath, isNew);
}
function getDailyNotePath(configuration: WorkspaceConfiguration, date: Date) {
  const rootDirectory = workspace.workspaceFolders[0].uri.fsPath;
  const dailyNoteDirectory: string =
    configuration.get("openDailyNote.directory") ?? ".";
  const dailyNoteFilename = getDailyNoteFileName(configuration, date);

  return join(rootDirectory, dailyNoteDirectory, dailyNoteFilename);
}

function getDailyNoteFileName(
  configuration: WorkspaceConfiguration,
  date: Date
): string {
  const filenameFormat: string = configuration.get(
    "openDailyNote.filenameFormat"
  );
  const fileExtension: string = configuration.get(
    "openDailyNote.fileExtension"
  );

  return `${dateFormat(date, filenameFormat, false)}.${fileExtension}`;
}

async function createDailyNoteIfNotExists(
  configuration: WorkspaceConfiguration,
  dailyNotePath: string,
  currentDate: Date
) {
  if (await pathExists(dailyNotePath)) {
    return false;
  }

  await createDailyNoteDirectoryIfNotExists(dailyNotePath);

  const titleFormat: string =
    configuration.get("openDailyNote.titleFormat") ??
    configuration.get("openDailyNote.filenameFormat");

  await fs.promises.writeFile(
    dailyNotePath,
    `# ${dateFormat(currentDate, titleFormat, false)}${docConfig.eol}${
      docConfig.eol
    }`
  );

  return true;
}

async function createDailyNoteDirectoryIfNotExists(dailyNotePath: string) {
  const dailyNoteDirectory = dirname(dailyNotePath);

  if (!(await pathExists(dailyNoteDirectory))) {
    await fs.promises.mkdir(dailyNoteDirectory, { recursive: true });
  }
}

async function focusDailyNote(dailyNotePath: string, isNewNote: boolean) {
  const document = await workspace.openTextDocument(Uri.file(dailyNotePath));
  const editor = await window.showTextDocument(document);

  // Move the cursor to end of the file
  if (isNewNote) {
    const { lineCount } = editor.document;
    const { range } = editor.document.lineAt(lineCount - 1);
    editor.selection = new Selection(range.end, range.end);
  }
}

function pathExists(path: string) {
  return fs.promises
    .access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export default feature;

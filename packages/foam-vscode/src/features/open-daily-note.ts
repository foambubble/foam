import {
  window,
  workspace,
  Uri,
  WorkspaceConfiguration,
  ExtensionContext,
  commands,
} from "vscode";
import { dirname, join } from "path";
import dateFormat = require("dateformat");
import fs = require("fs");
import { FoamFeature } from "../types";

const feature: FoamFeature = {
  activate: async (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.open-daily-note", openDailyNote)
    );
  },
};

async function openDailyNote() {
  const foamConfiguration = workspace.getConfiguration("foam");
  const currentDate = new Date();

  const dailyNotePath = getDailyNotePath(foamConfiguration, currentDate);

  createDailyNoteIfNotExists(foamConfiguration, dailyNotePath, currentDate);
  await focusDailyNote(dailyNotePath);
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
    return;
  }

  createDailyNoteDirectoryIfNotExists(dailyNotePath);

  const titleFormat: string =
    configuration.get("openDailyNote.titleFormat") ??
    configuration.get("openDailyNote.filenameFormat");

  await fs.promises.writeFile(
    dailyNotePath,
    `# ${dateFormat(currentDate, titleFormat, false)}\r\n`
  );
}

async function createDailyNoteDirectoryIfNotExists(dailyNotePath: string) {
  const dailyNoteDirectory = dirname(dailyNotePath);

  if (!(await pathExists(dailyNoteDirectory))) {
    await fs.promises.mkdir(dailyNoteDirectory, { recursive: true });
  }
}

async function focusDailyNote(dailyNotePath: string) {
  const document = await workspace.openTextDocument(Uri.parse(dailyNotePath));
  window.showTextDocument(document);
}

async function pathExists(path: string) {
  return fs.promises
    .access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export default feature;

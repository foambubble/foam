import {
  Selection,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration
} from "vscode";
import { dirname, join } from "path";
import dateFormat from "dateformat";
import * as fs from "fs";
import { docConfig, focusNote, pathExists } from "./utils";

async function openDailyNoteFor(date?: Date) {
  const foamConfiguration = workspace.getConfiguration("foam");
  const currentDate = date !== undefined ? date : new Date();

  const dailyNotePath = getDailyNotePath(foamConfiguration, currentDate);

  const isNew = await createDailyNoteIfNotExists(
    foamConfiguration,
    dailyNotePath,
    currentDate
  );
  await focusNote(dailyNotePath, isNew);
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

export {
  openDailyNoteFor,
  getDailyNoteFileName,
  createDailyNoteIfNotExists,
  getDailyNotePath
};

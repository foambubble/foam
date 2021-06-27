import { workspace, WorkspaceConfiguration, Uri } from 'vscode';
import dateFormat from 'dateformat';
import * as fs from 'fs';
import { isAbsolute } from 'path';
import { docConfig, focusNote, pathExists } from './utils';
import { URI } from 'foam-core';

/**
 * Open the daily note file.
 *
 * In the case that the daily note file does not exist,
 * it gets created along with any folders in its path.
 *
 * @param date A given date to be formatted as filename.
 */
async function openDailyNoteFor(date?: Date) {
  const foamConfiguration = workspace.getConfiguration('foam');
  const currentDate = date !== undefined ? date : new Date();

  const dailyNotePath = getDailyNotePath(foamConfiguration, currentDate);

  const isNew = await createDailyNoteIfNotExists(
    foamConfiguration,
    dailyNotePath,
    currentDate
  );
  await focusNote(dailyNotePath, isNew);
}

/**
 * Get the daily note file path.
 *
 * This function first checks the `foam.openDailyNote.directory` configuration string,
 * defaulting to the current directory.
 *
 * In the case that the directory path is not absolute,
 * the resulting path will start on the current workspace top-level.
 *
 * @param configuration The current workspace configuration.
 * @param date A given date to be formatted as filename.
 * @returns The path to the daily note file.
 */
function getDailyNotePath(
  configuration: WorkspaceConfiguration,
  date: Date
): URI {
  const dailyNoteDirectory: string =
    configuration.get('openDailyNote.directory') ?? '.';
  const dailyNoteFilename = getDailyNoteFileName(configuration, date);

  if (isAbsolute(dailyNoteDirectory)) {
    return URI.joinPath(Uri.file(dailyNoteDirectory), dailyNoteFilename);
  } else {
    return URI.joinPath(
      workspace.workspaceFolders[0].uri,
      dailyNoteDirectory,
      dailyNoteFilename
    );
  }
}

/**
 * Get the daily note filename (basename) to use.
 *
 * Fetch the filename format and extension from
 * `foam.openDailyNote.filenameFormat` and
 * `foam.openDailyNote.fileExtension`, respectively.
 *
 * @param configuration The current workspace configuration.
 * @param date A given date to be formatted as filename.
 * @returns The daily note's filename.
 */
function getDailyNoteFileName(
  configuration: WorkspaceConfiguration,
  date: Date
): string {
  const filenameFormat: string = configuration.get(
    'openDailyNote.filenameFormat'
  );
  const fileExtension: string = configuration.get(
    'openDailyNote.fileExtension'
  );

  return `${dateFormat(date, filenameFormat, false)}.${fileExtension}`;
}

/**
 * Create a daily note if it does not exist.
 *
 * In the case that the folders referenced in the file path also do not exist,
 * this function will create all folders in the path.
 *
 * @param configuration The current workspace configuration.
 * @param dailyNotePath The path to daily note file.
 * @param currentDate The current date, to be used as a title.
 * @returns Wether the file was created.
 */
async function createDailyNoteIfNotExists(
  configuration: WorkspaceConfiguration,
  dailyNotePath: URI,
  currentDate: Date
) {
  if (await pathExists(dailyNotePath)) {
    return false;
  }

  await createDailyNoteDirectoryIfNotExists(dailyNotePath);

  const titleFormat: string =
    configuration.get('openDailyNote.titleFormat') ??
    configuration.get('openDailyNote.filenameFormat');

  await fs.promises.writeFile(
    URI.toFsPath(dailyNotePath),
    `# ${dateFormat(currentDate, titleFormat, false)}${docConfig.eol}${
      docConfig.eol
    }`
  );

  return true;
}

/**
 * Create the directory (or directories) needed for the note to be placed in.
 *
 * If the daily note's folder does not exist,
 * create such directory and all other non-existent directories in the path.
 *
 * For example, for the path `/home/user/foam-template/journal/yyyy-mm-dd.md`,
 * it will create all directories in the path up until the file.
 *
 * @param dailyNotePath The path to the daily note file.
 */
async function createDailyNoteDirectoryIfNotExists(dailyNotePath: URI) {
  const dailyNoteDirectory = URI.getDir(dailyNotePath);

  if (!(await pathExists(dailyNoteDirectory))) {
    await fs.promises.mkdir(URI.toFsPath(dailyNoteDirectory), {
      recursive: true,
    });
  }
}

export {
  openDailyNoteFor,
  getDailyNoteFileName,
  createDailyNoteIfNotExists,
  getDailyNotePath,
};

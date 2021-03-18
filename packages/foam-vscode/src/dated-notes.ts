import { workspace, WorkspaceConfiguration, Uri } from 'vscode';
import dateFormat from 'dateformat';
import * as fs from 'fs';
import { isAbsolute } from 'path';
import { docConfig, focusNote, pathExists } from './utils';
import { uris, URI } from 'foam-core';

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

function getDailyNotePath(
  configuration: WorkspaceConfiguration,
  date: Date
): URI {
  const dailyNoteDirectory: string =
    configuration.get('openDailyNote.directory') ?? '.';
  const dailyNoteFilename = getDailyNoteFileName(configuration, date);

  if (isAbsolute(dailyNoteDirectory)) {
    return uris.joinPath(Uri.file(dailyNoteDirectory), dailyNoteFilename);
  } else {
    return uris.joinPath(
      workspace.workspaceFolders[0].uri,
      dailyNoteDirectory,
      dailyNoteFilename
    );
  }
}

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
    uris.toFsPath(dailyNotePath),
    `# ${dateFormat(currentDate, titleFormat, false)}${docConfig.eol}${
      docConfig.eol
    }`
  );

  return true;
}

async function createDailyNoteDirectoryIfNotExists(dailyNotePath: URI) {
  const dailyNoteDirectory = uris.getDir(dailyNotePath);

  if (!(await pathExists(dailyNoteDirectory))) {
    await fs.promises.mkdir(uris.toFsPath(dailyNoteDirectory), {
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

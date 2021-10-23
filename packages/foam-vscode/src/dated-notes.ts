import { workspace, WorkspaceConfiguration } from 'vscode';
import dateFormat from 'dateformat';
import { isAbsolute } from 'path';
import { focusNote, pathExists } from './utils';
import { URI } from './core/model/uri';
import { createNoteFromDailyNoteTemplate } from './features/create-from-template';

/**
 * Open the daily note file.
 *
 * In the case that the daily note file does not exist,
 * it gets created along with any folders in its path.
 *
 * @param date A given date to be formatted as filename.
 */
export async function openDailyNoteFor(date?: Date) {
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
export function getDailyNotePath(
  configuration: WorkspaceConfiguration,
  date: Date
): URI {
  const dailyNoteDirectory: string =
    configuration.get('openDailyNote.directory') ?? '.';
  const dailyNoteFilename = getDailyNoteFileName(configuration, date);

  if (isAbsolute(dailyNoteDirectory)) {
    return URI.joinPath(URI.file(dailyNoteDirectory), dailyNoteFilename);
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
export function getDailyNoteFileName(
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
export async function createDailyNoteIfNotExists(
  configuration: WorkspaceConfiguration,
  dailyNotePath: URI,
  targetDate: Date
) {
  if (await pathExists(dailyNotePath)) {
    return false;
  }

  const titleFormat: string =
    configuration.get('openDailyNote.titleFormat') ??
    configuration.get('openDailyNote.filenameFormat');

  const templateFallbackText: string = `---
foam_template:
  name: New Daily Note
  description: Foam's default daily note template
---
# ${dateFormat(targetDate, titleFormat, false)}
`;

  await createNoteFromDailyNoteTemplate(
    dailyNotePath,
    templateFallbackText,
    getDailyNoteVariables(targetDate)
  );

  return true;
}

/**
 * Creates a map of Foam template variables based on the given note
 *
 * Variable names are based on https://code.visualstudio.com/docs/editor/userdefinedsnippets:
 * - FOAM_DATE_YEAR
 * - FOAM_DATE_YEAR_SHORT
 * - FOAM_DATE_MONTH
 * - FOAM_DATE_MONTH_NAME
 * - FOAM_DATE_MONTH_NAME_SHORT
 * - FOAM_DATE_DATE
 * - FOAM_DATE_DAY_NAME
 * - FOAM_DATE_DAY_NAME_SHORT
 * - FOAM_DATE_HOUR
 * - FOAM_DATE_MINUTE
 * - FOAM_DATE_SECOND
 * - FOAM_DATE_SECONDS_UNIX
 *
 * @param targetDate The date used to generate the variables
 * @returns The map of variables
 */
export function getDailyNoteVariables(targetDate: Date): Map<string, string> {
  const dateVariables = new Map();
  dateVariables.set(
    'FOAM_DATE_YEAR',
    targetDate.toLocaleString('default', { year: 'numeric' })
  ); // The current year
  dateVariables.set(
    'FOAM_DATE_YEAR_SHORT',
    targetDate.toLocaleString('default', { year: '2-digit' })
  ); // The current year's last two digits
  dateVariables.set(
    'FOAM_DATE_MONTH',
    targetDate.toLocaleString('default', { month: '2-digit' })
  ); // The month as two digits (example '02')
  dateVariables.set(
    'FOAM_DATE_MONTH_NAME',
    targetDate.toLocaleString('default', { month: 'long' })
  ); //  The full name of the month (example 'July')
  dateVariables.set(
    'FOAM_DATE_MONTH_NAME_SHORT',
    targetDate.toLocaleString('default', { month: 'short' })
  ); //  The short name of the month (example 'Jul')
  dateVariables.set(
    'FOAM_DATE_DATE',
    targetDate.toLocaleString('default', { day: '2-digit' })
  ); //  The day of the month
  dateVariables.set(
    'FOAM_DATE_DAY_NAME',
    targetDate.toLocaleString('default', { weekday: 'long' })
  ); //  The name of day (example 'Monday')
  dateVariables.set(
    'FOAM_DATE_DAY_NAME_SHORT',
    targetDate.toLocaleString('default', { weekday: 'short' })
  ); //  The short name of the day (example 'Mon')
  dateVariables.set('FOAM_DATE_HOUR', '00'); //  The current hour in 24-hour clock format
  dateVariables.set('FOAM_DATE_MINUTE', '00'); //  The current minute
  dateVariables.set('FOAM_DATE_SECOND', '00'); //  The current second
  dateVariables.set('FOAM_DATE_SECONDS_UNIX', targetDate.getMilliseconds()); //  The number of seconds since the Unix epoch
  return dateVariables;
}

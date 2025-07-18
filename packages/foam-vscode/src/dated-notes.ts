import { joinPath } from './core/utils/path';
import dateFormat from 'dateformat';
import { URI } from './core/model/uri';
import { NoteFactory } from './services/templates';
import { getFoamVsCodeConfig } from './services/config';
import { asAbsoluteWorkspaceUri, focusNote } from './services/editor';
import { Foam } from './core/model/foam';

/**
 * Open the daily note file.
 *
 * In the case that the daily note file does not exist,
 * it gets created along with any folders in its path.
 *
 * @param date The target date. If not provided, the function returns immediately.
 * @param foam The Foam instance, used to create the note.
 */
export async function openDailyNoteFor(date?: Date, foam?: Foam) {
  if (date == null) {
    return;
  }

  const { didCreateFile, uri } = await createDailyNoteIfNotExists(date, foam);
  // if a new file is created, the editor is automatically created
  // but forcing the focus will block the template placeholders from working
  // so we only explicitly focus on the note if the file already exists
  if (!didCreateFile) {
    await focusNote(uri, didCreateFile);
  }
}

/**
 * Get the daily note file path.
 *
 * This function first checks the `foam.openDailyNote.directory` configuration string,
 * defaulting to the current directory.
 *
 * @param date A given date to be formatted as filename.
 * @returns The URI to the daily note file.
 */
export function getDailyNoteUri(date: Date): URI {
  const folder = getFoamVsCodeConfig<string>('openDailyNote.directory') ?? '.';
  const dailyNoteFilename = getDailyNoteFileName(date);
  return asAbsoluteWorkspaceUri(joinPath(folder, dailyNoteFilename));
}

/**
 * Get the daily note filename (basename) to use.
 *
 * Fetch the filename format and extension from
 * `foam.openDailyNote.filenameFormat` and
 * `foam.openDailyNote.fileExtension`, respectively.
 *
 * @param date A given date to be formatted as filename.
 * @returns The daily note's filename.
 */
export function getDailyNoteFileName(date: Date): string {
  const filenameFormat: string = getFoamVsCodeConfig(
    'openDailyNote.filenameFormat',
    'yyyy-mm-dd'
  );
  const fileExtension: string = getFoamVsCodeConfig(
    'openDailyNote.fileExtension',
    'md'
  );

  return `${dateFormat(date, filenameFormat, false)}.${fileExtension}`;
}

/**
 * Create a daily note using the unified creation engine (supports JS templates)
 *
 * @param targetDate The target date
 * @param foam The Foam instance
 * @returns Whether the file was created and the URI
 */
export async function createDailyNoteIfNotExists(targetDate: Date, foam: Foam) {
  const uriFromLegacyConfiguration = getDailyNoteUri(targetDate);
  const titleFormat: string =
    getFoamVsCodeConfig('openDailyNote.titleFormat') ??
    getFoamVsCodeConfig('openDailyNote.filenameFormat') ??
    'isoDate';

  const templateFallbackText = `# ${dateFormat(
    targetDate,
    titleFormat,
    false
  )}\n`;

  return await NoteFactory.createFromDailyNoteTemplate(
    uriFromLegacyConfiguration,
    templateFallbackText,
    targetDate,
    foam
  );
}

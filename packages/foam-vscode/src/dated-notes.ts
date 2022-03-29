import {
  QuickPickItem,
  window,
  workspace,
  WorkspaceConfiguration,
} from 'vscode';
import dateFormat from 'dateformat';
import { focusNote } from './utils';
import { URI } from './core/model/uri';
import { fromVsCodeUri, toVsCodeUri } from './utils/vsc-utils';
import { NoteFactory } from './services/templates';
import { setFlagsFromString } from 'v8';

export async function openDailyNoteForToday() {
  console.log('Open daily note for today');
  openDailyNoteFor();
}

class DateItem implements QuickPickItem {
  label: string;
  date: Date;

  constructor(public l: string, public d: Date) {
    this.label = l;
    this.date = d;
  }
}

function generateDateItems(): DateItem[] {
  const items = [];

  // Past
  for (let offset = -5; offset < -1; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    items.push(new DateItem(d.toDateString(), d));
  }

  // Yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  items.push(new DateItem('yesterday', yesterday));

  // Today
  const today = new DateItem('today', new Date());
  // today.picked = true;˙
  items.push(today);

  // Tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  items.push(new DateItem('tomorrow', tomorrow));

  // Future
  for (let offset = 2; offset < 6; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    items.push(new DateItem(d.toDateString(), d));
  }

  return items;
}

export async function openDailyNoteForPickedDate() {
  console.log('Open daily note for date');

  const result = await window.showQuickPick<DateItem>(generateDateItems(), {
    placeHolder: 'pick or enter a date (YYYY-MM-DD)',
    onDidSelectItem: item =>
      window.showInformationMessage(`Focus: ${(item as DateItem).date}`),
  });

  // TODO check for free form input and parse that
  // TODO check for cancel and handle that without error message
  // TODO remove all the

  console.log(`Date: ${result.date}`);
  openDailyNoteFor(result.date);

  // if (result.label == 'today') {
  //

  //   openDailyNoteFor();
  // } else if (result.label == 'tomorrow') {
  //   const date = new Date();
  //   date.setDate(date.getDate() + 1);

  //   openDailyNoteFor(date);
  // }
}

/**
 * Open the daily note file.
 *
 * In the case that the daily note file does not exist,
 * it gets created along with any folders in its path.
 *
 * @param date A given date to be formatted as filename.
 */
export async function openDailyNoteFor(date?: Date) {
  const targetDate = date instanceof Date ? date : new Date();

  const { didCreateFile, uri } = await createDailyNoteIfNotExists(targetDate);
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
  const dailyNoteDirectory = URI.file(
    configuration.get('openDailyNote.directory') ?? '.'
  );
  const dailyNoteFilename = getDailyNoteFileName(configuration, date);

  if (dailyNoteDirectory.isAbsolute()) {
    return dailyNoteDirectory.joinPath(dailyNoteFilename);
  } else {
    return fromVsCodeUri(workspace.workspaceFolders[0].uri).joinPath(
      dailyNoteDirectory.path,
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
 * @param currentDate The current date, to be used as a title.
 * @returns Wether the file was created.
 */
export async function createDailyNoteIfNotExists(targetDate: Date) {
  const configuration = workspace.getConfiguration('foam');
  const pathFromLegacyConfiguration = getDailyNotePath(
    configuration,
    targetDate
  );
  const titleFormat: string =
    configuration.get('openDailyNote.titleFormat') ??
    configuration.get('openDailyNote.filenameFormat');

  const templateFallbackText = `---
foam_template:
  filepath: "${workspace.asRelativePath(
    toVsCodeUri(pathFromLegacyConfiguration)
  )}"
---
# ${dateFormat(targetDate, titleFormat, false)}
`;

  return await NoteFactory.createFromDailyNoteTemplate(
    pathFromLegacyConfiguration,
    templateFallbackText,
    targetDate
  );
}

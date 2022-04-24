import {
  QuickPickItem,
  window,
  workspace,
  WorkspaceConfiguration,
  Disposable,
} from 'vscode';
import dateFormat from 'dateformat';
import { focusNote } from './utils';
import { URI } from './core/model/uri';
import { fromVsCodeUri, toVsCodeUri } from './utils/vsc-utils';
import { NoteFactory } from './services/templates';
import { setFlagsFromString } from 'v8';
import { ConsoleLogger } from './core/utils/log';

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

class MessageItem implements QuickPickItem {
  label: string;
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
  items.push(today);

  // Tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  items.push(new DateItem('tomorrow', tomorrow));

  // Future
  for (let offset = 2; offset < 8; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    items.push(new DateItem(d.toDateString(), d));
  }

  return items;
}

function generateParametricDateItems(basedOn: string): DateItem[] {
  const items = [];

  if (basedOn.length < 4) {
    return generateDateItems();
  }

  // Take first 4 to be a year
  const yearPart = basedOn.substring(0, 4);
  const year = parseInt(yearPart);

  // Generate all dates for the year
  for (let offset = 0; offset < 367; offset++) {
    const d = new Date(year, 0, 1, 0, 0, 0, 0);
    d.setDate(d.getDate() + offset);

    if (d.toISOString().startsWith(basedOn)) {
      // Keep only those that fit the input
      items.push(
        new DateItem(
          d.getFullYear() +
            '-' +
            (d.getMonth() + 1).toString().padStart(2, '0') +
            '-' +
            d
              .getDate()
              .toString()
              .padStart(2, '0'),
          d
        )
      );
    }
  }

  return items;
}

export async function openDailyNoteForPickedDate() {
  console.log('Open daily note for date');

  // const result = await window.showQuickPick<DateItem>(generateDateItems(), {
  //   placeHolder: 'pick or enter a date (YYYY-MM-DD)', // TODO fix the placeholder because we can't enter free form text
  //   // onDidSelectItem: item =>
  //   // window.showInformationMessage(`Focus: ${(item as DateItem).date}`),
  // });

  const result = await pickDate();

  if (result) {
    console.log(`Picked: ${result}`);

    openDailyNoteFor(result);
  } else {
    console.log('Cancelled');
  }
}

async function pickDate() {
  console.log('In pick date');

  const disposables: Disposable[] = [];

  try {
    return await new Promise<Date | undefined>((resolve, reject) => {
      const input = window.createQuickPick<DateItem | MessageItem>();
      input.placeholder = 'Choose or type a date (YYYY-MM-DD)';

      input.items = generateDateItems();

      disposables.push(
        input.onDidChangeValue(value => {
          input.items = generateParametricDateItems(value);
        }),
        input.onDidChangeSelection(items => {
          const item = items[0];
          if (item instanceof DateItem) {
            resolve(item.date);
            input.hide();
          }
        }),
        input.onDidHide(() => {
          resolve(undefined);
          input.dispose();
        })
      );

      input.show();
    });
  } finally {
    disposables.forEach(d => d.dispose());
  }
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

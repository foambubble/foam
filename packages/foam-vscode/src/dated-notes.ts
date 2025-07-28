import { Uri, window, workspace } from 'vscode';
import { joinPath } from './core/utils/path';
import dateFormat from 'dateformat';
import { URI } from './core/model/uri';
import { getDailyNoteTemplateUri } from './services/templates';
import { getFoamVsCodeConfig } from './services/config';
import { asAbsoluteWorkspaceUri, focusNote } from './services/editor';
import { Foam } from './core/model/foam';
import {
  CREATE_NOTE_COMMAND,
  createNote,
} from './features/commands/create-note';
import { fromVsCodeUri } from './utils/vsc-utils';
import { showInEditor } from './test/test-utils-vscode';

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

const DEFAULT_DAILY_NOTE_TEMPLATE = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
  description: "Daily note template"
---
# \${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}

> you probably want to delete these instructions as you customize your template

Welcome to your new daily note template.
The file is located in \`.foam/templates/daily-note.md\`.
The text in this file will be used as the content of your daily note.
You can customize it as you like, and you can use the following variables in the template:
- \`\${FOAM_DATE_YEAR}\`: The year of the date
- \`\${FOAM_DATE_MONTH}\`: The month of the date
- \`\${FOAM_DATE_DATE}\`: The day of the date
- \`\${FOAM_TITLE}\`: The title of the note

Go to https://github.com/foambubble/foam/blob/main/docs/user/features/daily-notes.md for more details.
For more complex templates, including Javascript dynamic templates, see https://github.com/foambubble/foam/blob/main/docs/user/features/note-templates.md.
`;

export const CREATE_DAILY_NOTE_WARNING_RESPONSE = 'Create daily note template';

/**
 * Create a daily note using the unified creation engine (supports JS templates)
 *
 * @param targetDate The target date
 * @param foam The Foam instance
 * @returns Whether the file was created and the URI
 */
export async function createDailyNoteIfNotExists(targetDate: Date, foam: Foam) {
  const templatePath = await getDailyNoteTemplateUri();

  if (!templatePath) {
    window
      .showWarningMessage(
        'No daily note template found. Using legacy configuration (deprecated). Create a daily note template to avoid this warning and customize your daily note.',
        CREATE_DAILY_NOTE_WARNING_RESPONSE
      )
      .then(async action => {
        if (action === CREATE_DAILY_NOTE_WARNING_RESPONSE) {
          const newTemplateUri = Uri.joinPath(
            workspace.workspaceFolders[0].uri,
            '.foam',
            'templates',
            'daily-note.md'
          );
          await workspace.fs.writeFile(
            newTemplateUri,
            new TextEncoder().encode(DEFAULT_DAILY_NOTE_TEMPLATE)
          );
          await showInEditor(fromVsCodeUri(newTemplateUri));
        }
      });
  }

  // Set up variables for template processing
  const formattedDate = dateFormat(targetDate, 'yyyy-mm-dd', false);
  const variables = {
    FOAM_TITLE: formattedDate,
    title: formattedDate,
  };

  const dailyNoteUri = getDailyNoteUri(targetDate);
  const titleFormat: string =
    getFoamVsCodeConfig('openDailyNote.titleFormat') ??
    getFoamVsCodeConfig('openDailyNote.filenameFormat') ??
    'isoDate';

  const templateFallbackText = `# ${dateFormat(
    targetDate,
    titleFormat,
    false
  )}\n`;

  return await createNote(
    {
      notePath: dailyNoteUri.toFsPath(),
      templatePath: templatePath,
      text: templateFallbackText,
      date: targetDate,
      variables: variables,
      onFileExists: 'open',
      onRelativeNotePath: 'resolve-from-root',
    },
    foam
  );
}

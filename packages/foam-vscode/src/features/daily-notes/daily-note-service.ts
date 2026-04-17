import dayjs from 'dayjs';
import { Uri, window, workspace } from 'vscode';
import { joinPath } from '../../core/utils/path';
import { URI } from '../../core/model/uri';
import { Foam } from '../../core/model/foam';
import { getDailyNoteTemplateUri } from '../../vscode/services/template-service';
import { NoteFactory } from '../../vscode/services/note-factory';
import { getFoamVsCodeConfig } from '../../vscode/config';
import {
  asAbsoluteWorkspaceUri,
  focusNote,
  readFile,
} from '../../services/editor';
import { resolveDailyNote } from '../../core/templates/daily-note-resolver';
import { Resolver } from '../../core/templates/variable-resolver';
import { fromVsCodeUri } from '../../utils/vsc-utils';

// ─── Format conversion ────────────────────────────────────────────────────────

// User-facing configuration uses dateformat-library syntax. Internally we use
// dayjs. This map handles the named masks; the regex below handles patterns.
const DATEFORMAT_NAMED_MASKS: Record<string, string> = {
  default: 'ddd MMM DD YYYY HH:mm:ss',
  isoDate: 'YYYY-MM-DD',
  shortDate: 'M/D/YY',
  paddedShortDate: 'MM/DD/YYYY',
  mediumDate: 'MMM D, YYYY',
  longDate: 'MMMM D, YYYY',
  fullDate: 'dddd, MMMM D, YYYY',
};

/**
 * Converts a dateformat-library format string (or named mask) to a dayjs
 * format string. Handles the most common date-only tokens used in Foam configs.
 * (this is to keep compatibility with users' existing filenameFormat configs,
 * which use dateformat syntax)
 *
 * Token mapping (dateformat → dayjs):
 *   yyyy → YYYY, yy → YY
 *   mmmm → MMMM, mmm → MMM, mm → MM, m → M
 *   dddd → dddd, ddd → ddd (day names — same in both)
 *   dd → DD, d → D  (day-of-month; dateformat's 'd' ≠ dayjs 'd' which is dow)
 */
function convertDateformatToDayjs(format: string): string {
  if (DATEFORMAT_NAMED_MASKS[format]) {
    return DATEFORMAT_NAMED_MASKS[format];
  }
  return format.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d/g, token => {
    switch (token) {
      case 'yyyy':
        return 'YYYY';
      case 'yy':
        return 'YY';
      case 'mmmm':
        return 'MMMM';
      case 'mmm':
        return 'MMM';
      case 'mm':
        return 'MM';
      case 'm':
        return 'M';
      case 'dddd':
        return 'dddd';
      case 'ddd':
        return 'ddd';
      case 'dd':
        return 'DD';
      case 'd':
        return 'D';
      default:
        return token;
    }
  });
}

function formatDailyNoteFileName(
  date: Date,
  format: string,
  extension: string
): string {
  return `${dayjs(date).format(convertDateformatToDayjs(format))}.${extension}`;
}

function formatDailyNoteLink(
  date: Date,
  format: string,
  extension: string
): string {
  const filename = formatDailyNoteFileName(date, format, extension);
  return `[[${filename.replace(`.${extension}`, '')}]]`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the wiki-link for a daily note, e.g. `[[2024-01-17]]`.
 * Reads filenameFormat and fileExtension from VS Code configuration.
 */
export function getDailyNoteLink(date: Date): string {
  const format: string = getFoamVsCodeConfig(
    'openDailyNote.filenameFormat',
    'yyyy-mm-dd'
  );
  const extension: string = getFoamVsCodeConfig(
    'openDailyNote.fileExtension',
    'md'
  );
  return formatDailyNoteLink(date, format, extension);
}

/**
 * Returns the daily note filename (basename).
 * Reads filenameFormat and fileExtension from VS Code configuration.
 */
export function getDailyNoteFileName(date: Date): string {
  const format: string = getFoamVsCodeConfig(
    'openDailyNote.filenameFormat',
    'yyyy-mm-dd'
  );
  const extension: string = getFoamVsCodeConfig(
    'openDailyNote.fileExtension',
    'md'
  );
  return formatDailyNoteFileName(date, format, extension);
}

/**
 * Returns the URI for a daily note file.
 * Reads openDailyNote.directory from VS Code configuration.
 */
export function getDailyNoteUri(date: Date): URI {
  const folder = getFoamVsCodeConfig<string>('openDailyNote.directory') ?? '.';
  const filename = getDailyNoteFileName(date);
  return asAbsoluteWorkspaceUri(joinPath(folder, filename));
}

/**
 * Opens the daily note for the given date, creating it if it does not exist.
 */
export async function openDailyNoteFor(date?: Date, foam?: Foam) {
  if (date == null) {
    return;
  }

  const { didCreateFile, uri } = await createDailyNoteIfNotExists(date, foam);
  // if a new file is created, the editor is automatically opened,
  // but forcing focus will block template placeholders from working —
  // so we only explicitly focus when the file already existed
  if (!didCreateFile) {
    await focusNote(uri, didCreateFile);
  }
}

// ─── Note creation ────────────────────────────────────────────────────────────

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
For more complex templates, including Javascript dynamic templates, see https://github.com/foambubble/foam/blob/main/docs/user/features/templates.md.
`;

export const CREATE_DAILY_NOTE_WARNING_RESPONSE = 'Create daily note template';

/**
 * Creates a daily note using the unified creation engine (supports JS templates).
 */
export async function createDailyNoteIfNotExists(targetDate: Date, foam: Foam) {
  const templateUri = await getDailyNoteTemplateUri();

  if (!templateUri) {
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
          await focusNote(fromVsCodeUri(newTemplateUri), false);
        }
      });
  }

  const locale = getFoamVsCodeConfig<string>('dateLocale', 'default');
  const formattedDate = dayjs(targetDate).format('YYYY-MM-DD');
  const variables = new Map([['FOAM_TITLE', formattedDate]]);
  const resolver = new Resolver(variables, targetDate, undefined, locale);

  if (!templateUri) {
    // Legacy fallback: derive filepath and content from deprecated config
    const titleFormat: string =
      getFoamVsCodeConfig('openDailyNote.titleFormat') ??
      getFoamVsCodeConfig('openDailyNote.filenameFormat') ??
      'isoDate';
    const fallbackText = `# ${dayjs(targetDate).format(
      convertDateformatToDayjs(titleFormat)
    )}\n`;
    const dailyNoteUri = getDailyNoteUri(targetDate);
    return NoteFactory.createNote(dailyNoteUri, fallbackText, resolver, 'open');
  }

  const result = await resolveDailyNote(
    targetDate,
    templateUri,
    foam,
    readFile,
    {
      locale,
      isTrusted: workspace.isTrusted,
      fallbackFilepath: getDailyNoteUri(targetDate),
      variables,
    }
  );

  // Foam variables are already resolved; pass a date-only Resolver so that
  // any remaining VS Code snippet syntax in the content is preserved as-is.
  return NoteFactory.createNote(
    result.filepath,
    result.content,
    resolver,
    'open'
  );
}

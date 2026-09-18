import dayjs from 'dayjs';
import { window, workspace } from 'vscode';
import {
  convertDateformatToDayjs,
  findPreviousDailyNote,
  joinPath,
  partsFromDailyNoteSettings,
  partsFromTemplateFilepath,
  Resolver,
  Template,
  TriggerFactory,
} from '@foam/core';
import { URI } from '@foam/core';
import { Foam } from '@foam/core';
import {
  getDailyNoteTemplateUri,
  getTemplatesDir,
} from '../../../vscode/services/template-service';
import { NoteFactory } from '../../../vscode/services/note-factory';
import { getFoamVsCodeConfig } from '../../../vscode/config';
import {
  asAbsoluteWorkspaceUri,
  focusNote,
  readFile,
  writeFile,
} from '../../services/editor';
import { TemplateLoader } from '@foam/core/scripting';

// ─── Format conversion ────────────────────────────────────────────────────────

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
The file is located in your Foam templates folder (\`.foam/templates\` by default).
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
    // Fire-and-forget: must not block daily note creation.
    // The user can click the button to create a template at any time.
    window
      .showWarningMessage(
        'No daily note template found. Using legacy configuration (deprecated). Create a daily note template to avoid this warning and customize your daily note.',
        CREATE_DAILY_NOTE_WARNING_RESPONSE
      )
      .then(async action => {
        if (action === CREATE_DAILY_NOTE_WARNING_RESPONSE) {
          // Must match where getDailyNoteTemplateUri looks, which follows
          // `foam.templates.folder` — otherwise the file lands somewhere Foam
          // never reads and this warning comes back every time.
          await writeFile(
            getTemplatesDir().joinPath('daily-note.md'),
            DEFAULT_DAILY_NOTE_TEMPLATE
          );
        }
      });
  }

  const locale = getFoamVsCodeConfig<string>('dateLocale', 'default');
  const formattedDate = dayjs(targetDate).format('YYYY-MM-DD');
  const variables = new Map([['FOAM_TITLE', formattedDate]]);

  // FOAM_PREVIOUS_DAILY_NOTE recognizes daily notes by inverting the pattern
  // that writes one, so the template has to be loaded before the resolver.
  // `createNote` calls `loadTemplate` once, before anything else, so this is
  // the same single load moved a few lines earlier.
  const template = templateUri
    ? await new TemplateLoader(readFile, workspace.isTrusted).loadTemplate(
        templateUri
      )
    : legacyDailyNoteTemplate(targetDate);

  const resolver = new Resolver(
    variables,
    targetDate,
    undefined,
    locale,
    undefined,
    before => {
      const uri = findPreviousDailyNote(
        foam.workspace,
        dailyNotePathPattern(template),
        before
      );
      return uri && foam.workspace.getIdentifier(uri);
    }
  );

  return NoteFactory.createNote(foam, {
    trigger: TriggerFactory.createCommandTrigger('foam.open-daily-note'),
    resolver,
    loadTemplate: async () => template,
    fallbackFilepath: getDailyNoteUri(targetDate),
    onFileExists: 'open',
  });
}

/**
 * Where daily notes live, as a pattern that can be read backwards. The
 * template's `filepath` wins outright over the deprecated `openDailyNote.*`
 * settings — it is what actually writes the note.
 */
function dailyNotePathPattern(template: Template) {
  const templateFilepath =
    template.type === 'markdown'
      ? template.metadata.get('filepath')
      : undefined;
  return templateFilepath
    ? partsFromTemplateFilepath(templateFilepath)
    : partsFromDailyNoteSettings(
        getFoamVsCodeConfig<string>('openDailyNote.directory') ?? '.',
        getFoamVsCodeConfig('openDailyNote.filenameFormat', 'yyyy-mm-dd'),
        getFoamVsCodeConfig('openDailyNote.fileExtension', 'md')
      );
}

/** Daily note content from the deprecated config, when no template exists. */
function legacyDailyNoteTemplate(targetDate: Date): Template {
  const titleFormat: string =
    getFoamVsCodeConfig('openDailyNote.titleFormat') ??
    getFoamVsCodeConfig('openDailyNote.filenameFormat') ??
    'isoDate';
  const title = dayjs(targetDate).format(convertDateformatToDayjs(titleFormat));
  return {
    type: 'markdown',
    metadata: new Map(),
    content: `# ${title}\n`,
  };
}

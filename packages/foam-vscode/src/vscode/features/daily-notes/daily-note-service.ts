import dayjs from 'dayjs';
import { window, workspace } from 'vscode';
import {
  Config,
  convertDateformatToDayjs,
  dailyNoteSettings,
  dailyNoteSettingsPath,
  DEFAULT_DAILY_NOTE_TEMPLATE,
  prepareDailyNote,
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
 * Returns the URI for a daily note file, from the `openDailyNote.*` settings.
 */
export function getDailyNoteUri(date: Date): URI {
  return asAbsoluteWorkspaceUri(
    dailyNoteSettingsPath(date, dailyNoteSettings(Config))
  );
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

  const template =
    templateUri &&
    (await new TemplateLoader(readFile, workspace.isTrusted).loadTemplate(
      templateUri
    ));
  const daily = prepareDailyNote(
    targetDate,
    template,
    dailyNoteSettings(Config),
    foam.workspace,
    Config.getDateLocale()
  );

  return NoteFactory.createNote(foam, {
    trigger: daily.trigger,
    resolver: daily.resolver,
    loadTemplate: async () => daily.template,
    fallbackFilepath: daily.fallbackFilepath,
    onFileExists: 'open',
  });
}

import { window, workspace } from 'vscode';
import {
  Config,
  dailyNoteName,
  DEFAULT_DAILY_NOTE_TEMPLATE,
  prepareDailyNote,
} from '@foam/core';
import { Foam } from '@foam/core';
import {
  getDailyNoteTemplateUri,
  getTemplatesDir,
} from '../../../vscode/services/template-service';
import { NoteFactory } from '../../../vscode/services/note-factory';
import { readFile, writeFile } from '../../services/editor';
import { TemplateLoader } from '@foam/core/scripting';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the wiki-link to the daily note for each date, e.g. `[[2024-01-17]]`,
 * named the way the daily-note template names it.
 */
export async function getDailyNoteLinks(dates: Date[]): Promise<string[]> {
  const templateUri = await getDailyNoteTemplateUri();
  // Loading a JavaScript template runs it, and its notes are assumed to be
  // named the default way anyway
  const template =
    templateUri && !templateUri.path.endsWith('.js')
      ? await new TemplateLoader(readFile, false).loadTemplate(templateUri)
      : undefined;
  return Promise.all(
    dates.map(
      async date =>
        `[[${await dailyNoteName(date, template, Config.getDateLocale())}]]`
    )
  );
}

/**
 * Opens the daily note for the given date, creating it if it does not exist.
 */
export async function openDailyNoteFor(date?: Date, foam?: Foam) {
  if (date == null) {
    return;
  }

  // This will also open the note
  await createDailyNoteIfNotExists(date, foam);
}

// ─── Note creation ────────────────────────────────────────────────────────────

export const CREATE_DAILY_NOTE_WARNING_RESPONSE = 'Create daily note template';

/**
 * Creates a daily note using the unified creation engine (supports JS templates).
 */
export async function createDailyNoteIfNotExists(targetDate: Date, foam: Foam) {
  const templateUri = await getDailyNoteTemplateUri();
  const template =
    templateUri &&
    (await new TemplateLoader(readFile, workspace.isTrusted).loadTemplate(
      templateUri
    ));

  if (!templateUri) {
    // Fire-and-forget: must not block daily note creation.
    // The user can click the button to create a template at any time.
    window
      .showWarningMessage(
        'No daily note template found. Create a daily note template to avoid this warning and customize your daily note.',
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

  const daily = prepareDailyNote(
    targetDate,
    template,
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

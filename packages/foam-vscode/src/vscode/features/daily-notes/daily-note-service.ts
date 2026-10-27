import { window, workspace } from 'vscode';
import {
  Config,
  dailyNoteName,
  DEFAULT_DAILY_NOTE_TEMPLATE,
  ignoredDailyNoteSettings,
  ignoredDailyNoteSettingsMessage,
  LegacyDailyNoteSettings,
  legacyDailyNoteFrontmatter,
  legacyDailyNoteTemplate,
  prepareDailyNote,
  URI,
} from '@foam/core';
import { Foam } from '@foam/core';
import {
  getDailyNoteTemplateUri,
  getTemplatesDir,
} from '../../../vscode/services/template-service';
import { NoteFactory } from '../../../vscode/services/note-factory';
import { focusNote, readFile, writeFile } from '../../services/editor';
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
export const OPEN_DAILY_NOTE_TEMPLATE_RESPONSE = 'Open daily note template';

/**
 * Creates a daily note using the unified creation engine (supports JS templates).
 * Creates nothing, returning `undefined`, when `foam.openDailyNote.*` settings
 * Foam no longer reads would have placed the note and the user does not
 * create a template that keeps them.
 */
export async function createDailyNoteIfNotExists(targetDate: Date, foam: Foam) {
  const templateUri = await getDailyNoteTemplateUri();
  const loader = new TemplateLoader(readFile, workspace.isTrusted);
  let template = templateUri && (await loader.loadTemplate(templateUri));

  const legacySettings = Config.getLegacyDailyNoteSettings();
  const ignored = ignoredDailyNoteSettings(template, legacySettings);
  if (ignored.length > 0) {
    const keepingTemplate = await askToKeepLegacySettings(
      templateUri,
      legacySettings,
      ignored
    );
    if (!keepingTemplate) {
      return undefined;
    }
    template = await loader.loadTemplate(keepingTemplate);
  } else if (!templateUri) {
    // Fire-and-forget: must not block daily note creation.
    // The user can click the button to create a template at any time.
    window
      .showWarningMessage(
        'No daily note template found. Create a daily note template to avoid this warning and customize your daily note.',
        CREATE_DAILY_NOTE_WARNING_RESPONSE
      )
      .then(async action => {
        if (action === CREATE_DAILY_NOTE_WARNING_RESPONSE) {
          await writeFile(
            dailyNoteTemplateTarget(),
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

/**
 * Must match where getDailyNoteTemplateUri looks, which follows
 * `foam.templates.folder` — otherwise the file lands somewhere Foam never
 * reads and the warning comes back every time.
 */
const dailyNoteTemplateTarget = () =>
  getTemplatesDir().joinPath('daily-note.md');

/**
 * Says the settings are ignored and offers to keep what they did: with no
 * template, by writing one that does; with a template that sets no
 * `filepath`, by showing the one to add. Returns the template to create the
 * note from, or `undefined` when no note should be created.
 */
async function askToKeepLegacySettings(
  templateUri: URI | undefined,
  settings: LegacyDailyNoteSettings,
  ignored: string[]
): Promise<URI | undefined> {
  const those = ignored.length > 1 ? 'these settings' : 'this setting';
  const useDefault = `Or remove ${those} to create daily notes in journal/ as YYYY-MM-DD.md.`;

  if (!templateUri) {
    const action = await window.showWarningMessage(
      ignoredDailyNoteSettingsMessage(ignored),
      {
        modal: true,
        detail: `Create a daily note template that keeps creating daily notes as before. ${useDefault}`,
      },
      CREATE_DAILY_NOTE_WARNING_RESPONSE
    );
    if (action !== CREATE_DAILY_NOTE_WARNING_RESPONSE) {
      return undefined;
    }
    const target = dailyNoteTemplateTarget();
    await writeFile(target, legacyDailyNoteTemplate(settings));
    return target;
  }

  const action = await window.showWarningMessage(
    ignoredDailyNoteSettingsMessage(ignored),
    {
      modal: true,
      detail: `To keep daily notes where they were, add this to the daily note template's frontmatter:\n\n${legacyDailyNoteFrontmatter(
        settings
      )}\n\n${useDefault}`,
    },
    OPEN_DAILY_NOTE_TEMPLATE_RESPONSE
  );
  if (action === OPEN_DAILY_NOTE_TEMPLATE_RESPONSE) {
    await focusNote(templateUri, false);
  }
  return undefined;
}

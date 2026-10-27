import { FoamError } from '../common/errors';
import { LegacyDailyNoteSettings } from '../config';
import { URI } from '../model/uri';
import { Foam } from '../model/foam';
import { TemplateLoader } from './template-loader';
import { NoteCreationEngine } from './note-creation-engine';
import { NoteCreationResult } from './note-creation-types';
import { ignoredDailyNoteSettingsNotice } from './daily-note-location';
import { prepareDailyNote } from './daily-note-creation';

export interface ResolveDailyNoteOptions {
  locale?: string;
  isTrusted?: boolean;
}

/**
 * Resolves the daily note content and filepath for a given date, as
 * {@link prepareDailyNote} describes it. Loads the template, which for a
 * JavaScript template means running it in Node's `vm`.
 * No VS Code dependency — suitable for CLI and other non-VS Code contexts.
 *
 * Refuses, with a message saying how to keep them, while `foam.openDailyNote.*`
 * settings Foam no longer reads would have placed or titled the note:
 * resolving it anyway would quietly put it somewhere else.
 *
 * @param date The date for the daily note
 * @param templateUri The daily note template, or `undefined` when there is none
 * @param foam The Foam workspace instance
 * @param readFile Function to read file contents by URI
 * @param legacySettings The `foam.openDailyNote.*` settings the user set
 * @param options Optional locale and trust flag
 * @returns The resolved filepath and content for the daily note
 */
export async function resolveDailyNote(
  date: Date,
  templateUri: URI | undefined,
  foam: Foam,
  readFile: (uri: URI) => Promise<string>,
  legacySettings: LegacyDailyNoteSettings,
  options: ResolveDailyNoteOptions = {}
): Promise<NoteCreationResult> {
  const { locale = 'default', isTrusted = false } = options;

  const template =
    templateUri &&
    (await new TemplateLoader(readFile, isTrusted).loadTemplate(templateUri));
  const notice = ignoredDailyNoteSettingsNotice(
    template,
    legacySettings,
    foam.workspace.roots
  );
  if (notice) {
    throw new FoamError('invalid_input', `${notice.message} ${notice.detail}`, {
      settings: notice.settings,
    });
  }
  const daily = prepareDailyNote(date, template, foam.workspace, locale);
  return new NoteCreationEngine(foam).processTemplate(
    daily.trigger,
    daily.template,
    daily.resolver,
    { defaultFilepath: daily.fallbackFilepath }
  );
}

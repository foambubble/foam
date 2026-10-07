import { URI } from '../model/uri';
import { Foam } from '../model/foam';
import { TemplateLoader } from './template-loader';
import { NoteCreationEngine } from './note-creation-engine';
import { NoteCreationResult } from './note-creation-types';
import { DailyNoteSettings } from './daily-note-location';
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
 * @param date The date for the daily note
 * @param templateUri The daily note template, or `undefined` when there is none
 * @param foam The Foam workspace instance
 * @param readFile Function to read file contents by URI
 * @param settings The `openDailyNote.*` settings
 * @param options Optional locale and trust flag
 * @returns The resolved filepath and content for the daily note
 */
export async function resolveDailyNote(
  date: Date,
  templateUri: URI | undefined,
  foam: Foam,
  readFile: (uri: URI) => Promise<string>,
  settings: DailyNoteSettings,
  options: ResolveDailyNoteOptions = {}
): Promise<NoteCreationResult> {
  const { locale = 'default', isTrusted = false } = options;

  const template =
    templateUri &&
    (await new TemplateLoader(readFile, isTrusted).loadTemplate(templateUri));
  const daily = prepareDailyNote(
    date,
    template,
    settings,
    foam.workspace,
    locale
  );
  return new NoteCreationEngine(foam).processTemplate(
    daily.trigger,
    daily.template,
    daily.resolver,
    { defaultFilepath: daily.fallbackFilepath }
  );
}

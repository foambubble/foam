import { FoamError } from '../common/errors';
import { LegacyDailyNoteSettings } from '../config';
import { URI } from '../model/uri';
import { Foam } from '../model/foam';
import { TemplateLoader } from './template-loader';
import { NoteCreationEngine } from './note-creation-engine';
import { NoteCreationResult, Template } from './note-creation-types';
import {
  ignoredDailyNoteSettings,
  ignoredDailyNoteSettingsMessage,
  legacyDailyNoteFrontmatter,
  legacyDailyNoteTemplate,
  OUTSIDE_THE_WORKSPACE,
} from './daily-note-location';
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
  const ignored = ignoredDailyNoteSettings(template, legacySettings);
  if (ignored.length > 0) {
    throw new FoamError(
      'invalid_input',
      ignoredSettingsGuidance(
        template,
        legacySettings,
        ignored,
        foam.workspace.roots
      ),
      { settings: ignored }
    );
  }
  const daily = prepareDailyNote(date, template, foam.workspace, locale);
  return new NoteCreationEngine(foam).processTemplate(
    daily.trigger,
    daily.template,
    daily.resolver,
    { defaultFilepath: daily.fallbackFilepath }
  );
}

function ignoredSettingsGuidance(
  template: Template | undefined,
  settings: LegacyDailyNoteSettings,
  ignored: string[],
  roots: URI[]
): string {
  const those = ignored.length > 1 ? 'those settings' : 'that setting';
  const useDefault = `remove ${those} to create daily notes in journal/ as YYYY-MM-DD.md.`;
  const frontmatter = legacyDailyNoteFrontmatter(settings, roots);
  if (!frontmatter) {
    return `${ignoredDailyNoteSettingsMessage(
      ignored
    )} ${OUTSIDE_THE_WORKSPACE} Move them into the workspace and set the daily note template's filepath, or ${useDefault}`;
  }
  const keep = template
    ? `To keep daily notes where they were, add this to the daily note template's frontmatter:\n\n${frontmatter}\n`
    : `To keep creating daily notes as before, save this as daily-note.md in the templates folder:\n\n${legacyDailyNoteTemplate(
        settings,
        roots
      )}`;
  return `${ignoredDailyNoteSettingsMessage(
    ignored
  )} ${keep}\nOr ${useDefault}`;
}

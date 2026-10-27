import dayjs from 'dayjs';
import { LegacyDailyNoteSettings } from '../config';
import { convertDateformatToDayjs } from '../utils/date-format';
import { getName, joinPath } from '../utils/path';
import {
  PatternPart,
  partsFromTemplateFilepath,
} from './daily-note-path-pattern';
import { Template } from './note-creation-types';
import { Resolver } from './variable-resolver';

/**
 * Where daily notes go when the daily-note template does not say otherwise.
 * It matches the folder of {@link DEFAULT_DAILY_NOTE_TEMPLATE}, so creating
 * that template does not move where daily notes land.
 */
export const DEFAULT_DAILY_NOTE_DIRECTORY = 'journal';

/** How daily notes are named when the template does not name them. */
const DEFAULT_DAILY_NOTE_NAME_FORMAT = 'YYYY-MM-DD';

/** The `filepath` of {@link DEFAULT_DAILY_NOTE_TEMPLATE}. */
const DEFAULT_DAILY_NOTE_FILEPATH = `/${DEFAULT_DAILY_NOTE_DIRECTORY}/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md`;

/** The template Foam offers to write when a workspace has none. */
export const DEFAULT_DAILY_NOTE_TEMPLATE = `---
foam_template:
  filepath: "${DEFAULT_DAILY_NOTE_FILEPATH}"
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

/**
 * Which source places daily notes. A JavaScript template computes its path as
 * it runs, so nothing outside that run can know where its notes are.
 */
export type DailyNoteRule = 'template' | 'default' | 'unavailable';

export function dailyNoteRule(template: Template | undefined): DailyNoteRule {
  if (template?.type === 'javascript') {
    return 'unavailable';
  }
  return template?.metadata.get('filepath') ? 'template' : 'default';
}

/**
 * Where the daily note for `date` goes when the template does not set a
 * `filepath`, relative to the workspace root.
 */
export function defaultDailyNotePath(date: Date): string {
  return joinPath(
    DEFAULT_DAILY_NOTE_DIRECTORY,
    `${dayjs(date).format(DEFAULT_DAILY_NOTE_NAME_FORMAT)}.md`
  );
}

/**
 * The pattern daily notes follow, for recognising them among workspace paths:
 * the template's `filepath`, else the default location. `undefined` when the
 * pattern cannot be read back (see `daily-note-path-pattern.ts`), including
 * for a JavaScript template: reading the default instead would point at paths
 * that template never writes to.
 */
export function dailyNotePattern(
  template: Template | undefined
): PatternPart[] | undefined {
  if (template?.type === 'javascript') {
    return undefined;
  }
  return partsFromTemplateFilepath(
    template?.metadata.get('filepath') || DEFAULT_DAILY_NOTE_FILEPATH
  );
}

/**
 * The file name, without extension, the daily note for `date` gets, which is
 * what a wikilink to it says. A JavaScript template picks its filepath as it
 * runs, so it is assumed to follow the default.
 *
 * @param locale for the locale-sensitive `FOAM_DATE_*` variables
 */
export async function dailyNoteName(
  date: Date,
  template: Template | undefined,
  locale = 'default'
): Promise<string> {
  const filepath =
    template?.type === 'markdown' ? template.metadata.get('filepath') : '';
  if (!filepath) {
    return dayjs(date).format(DEFAULT_DAILY_NOTE_NAME_FORMAT);
  }
  const resolver = new Resolver(
    new Map([['FOAM_TITLE', dayjs(date).format('YYYY-MM-DD')]]),
    date,
    undefined,
    locale
  );
  return getName(await resolver.resolveText(filepath));
}

const LEGACY_SETTING_NAMES: Record<keyof LegacyDailyNoteSettings, string> = {
  directory: 'foam.openDailyNote.directory',
  filenameFormat: 'foam.openDailyNote.filenameFormat',
  fileExtension: 'foam.openDailyNote.fileExtension',
  titleFormat: 'foam.openDailyNote.titleFormat',
};

/**
 * The `foam.openDailyNote.*` settings that are set and would have changed
 * where daily notes go or what a new one holds, now that Foam ignores them.
 * Empty when ignoring them changes nothing: the template's `filepath` (or a
 * JavaScript template's own) placed the note, and the template its content.
 */
export function ignoredDailyNoteSettings(
  template: Template | undefined,
  settings: LegacyDailyNoteSettings
): string[] {
  if (template?.type === 'javascript' || template?.metadata.get('filepath')) {
    return [];
  }
  return (
    Object.keys(LEGACY_SETTING_NAMES) as (keyof LegacyDailyNoteSettings)[]
  )
    .filter(key => settings[key] !== undefined)
    .filter(key => !template || key !== 'titleFormat')
    .map(key => LEGACY_SETTING_NAMES[key]);
}

/** E.g. "foam.openDailyNote.directory and foam.openDailyNote.titleFormat are no longer used." */
export function ignoredDailyNoteSettingsMessage(names: string[]): string {
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0];
  return `${list} ${names.length > 1 ? 'are' : 'is'} no longer used.`;
}

/**
 * The daily-note template `filepath` that places daily notes where the
 * settings did, with the old defaults for the settings that are not set.
 */
export function legacyDailyNoteFilepath(
  settings: LegacyDailyNoteSettings
): string {
  // Normalized the way `joinPath` normalized it when the settings placed a
  // note, so `diary`, `./diary` and `notes/../diary` all name the same folder.
  let dir = joinPath(
    (settings.directory ?? DEFAULT_DAILY_NOTE_DIRECTORY).replace(/\\/g, '/')
  );
  while (dir.length > 1 && dir.endsWith('/')) {
    dir = dir.slice(0, -1);
  }
  // A relative directory was resolved against the workspace root, which is
  // what a leading `/` means in a template filepath
  const prefix =
    dir === '.' || dir === '/'
      ? '/'
      : dir.startsWith('/') || /^[a-zA-Z]:/.test(dir)
      ? `${dir}/`
      : `/${dir}/`;
  return `${prefix}${dateVariable(settings.filenameFormat ?? 'isoDate')}.${
    settings.fileExtension ?? 'md'
  }`;
}

/** The `foam_template` frontmatter that places daily notes where the settings did. */
export function legacyDailyNoteFrontmatter(
  settings: LegacyDailyNoteSettings
): string {
  // Single-quoted, so YAML leaves the backslashes of escapes in the format alone
  const filepath = legacyDailyNoteFilepath(settings).replace(/'/g, "''");
  return `foam_template:\n  filepath: '${filepath}'`;
}

/**
 * A daily-note template that creates daily notes where and as the settings
 * did: placed by them, holding only a heading with the date formatted by
 * `titleFormat`, else `filenameFormat`.
 */
export function legacyDailyNoteTemplate(
  settings: LegacyDailyNoteSettings
): string {
  const titleFormat =
    settings.titleFormat ?? settings.filenameFormat ?? 'isoDate';
  return `---\n${legacyDailyNoteFrontmatter(settings)}\n---\n# ${dateVariable(
    titleFormat
  )}\n`;
}

/**
 * `$FOAM_DATE_FORMAT` for a dateformat-style format, as the settings used it.
 * Only Foam variables are resolved, the text around them is kept as it is, so
 * only the format inside the variable needs escaping.
 */
function dateVariable(dateformat: string): string {
  const format = convertDateformatToDayjs(dateformat).replace(
    /[$}\\]/g,
    '\\$&'
  );
  return `\${FOAM_DATE_FORMAT:${format}}`;
}

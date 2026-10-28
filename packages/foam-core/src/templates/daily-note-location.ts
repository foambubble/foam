import dayjs from 'dayjs';
import { LegacyDailyNoteSettings } from '../config';
import { URI, asAbsoluteUri, findRootByName } from '../model/uri';
import { convertDateformatToDayjs } from '../utils/date-format';
import {
  getBasename,
  getName,
  isPathWithin,
  joinPath,
  relativeTo,
} from '../utils/path';
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
 * The `foam.openDailyNote.*` settings that would have put a daily note
 * somewhere else, or titled it differently, than Foam now does without them.
 * Empty when ignoring them changes nothing: they spell out what Foam does
 * anyway, or the template's `filepath` (or a JavaScript template's own)
 * places the note and the template gives its content.
 */
export function ignoredDailyNoteSettings(
  template: Template | undefined,
  settings: LegacyDailyNoteSettings,
  roots: URI[]
): string[] {
  if (template?.type === 'javascript' || template?.metadata.get('filepath')) {
    return [];
  }
  const changesNote: Record<
    keyof LegacyDailyNoteSettings,
    (value: string) => boolean
  > = {
    directory: value =>
      legacyDailyNoteFolder(value, roots).path !==
      legacyDailyNoteFolder(DEFAULT_DAILY_NOTE_DIRECTORY, roots).path,
    filenameFormat: value =>
      convertDateformatToDayjs(value) !== DEFAULT_DAILY_NOTE_NAME_FORMAT,
    fileExtension: value => value !== 'md',
    // A template gives the content, title included
    titleFormat: value =>
      !template &&
      convertDateformatToDayjs(value) !== DEFAULT_DAILY_NOTE_NAME_FORMAT,
  };
  return (
    Object.keys(LEGACY_SETTING_NAMES) as (keyof LegacyDailyNoteSettings)[]
  )
    .filter(
      key => settings[key] !== undefined && changesNote[key](settings[key])
    )
    .map(key => LEGACY_SETTING_NAMES[key]);
}

/** What Foam can do to keep what the ignored settings did. */
export type IgnoredDailyNoteSettingsFix =
  /** The workspace has no daily-note template, and writing this one keeps it */
  | { kind: 'create-template'; template: string }
  /** The template sets no `filepath`, and adding the one the detail shows keeps it */
  | { kind: 'add-filepath' }
  /** The settings put daily notes outside the workspace, where no template can */
  | { kind: 'none' };

/** What to tell the user about the `foam.openDailyNote.*` settings Foam ignores. */
export interface IgnoredDailyNoteSettingsNotice {
  /** The settings that would have changed the note. */
  settings: string[];
  /** E.g. "foam.openDailyNote.directory is no longer used." */
  message: string;
  /** How to keep what they did, or why no template can, then how to do without them. */
  detail: string;
  fix: IgnoredDailyNoteSettingsFix;
}

/**
 * What to tell the user before creating a daily note while settings Foam
 * ignores would have placed or titled it differently, or `undefined` when
 * ignoring them changes nothing (see {@link ignoredDailyNoteSettings}).
 */
export function ignoredDailyNoteSettingsNotice(
  template: Template | undefined,
  settings: LegacyDailyNoteSettings,
  roots: URI[]
): IgnoredDailyNoteSettingsNotice | undefined {
  const ignored = ignoredDailyNoteSettings(template, settings, roots);
  if (ignored.length === 0) {
    return undefined;
  }
  const several = ignored.length > 1;
  const list = several
    ? `${ignored.slice(0, -1).join(', ')} and ${ignored[ignored.length - 1]}`
    : ignored[0];
  const message = `${list} ${several ? 'are' : 'is'} no longer used.`;
  const useDefault = `remove ${
    several ? 'these settings' : 'this setting'
  } to create daily notes in journal/ as YYYY-MM-DD.md.`;

  const frontmatter = legacyDailyNoteFrontmatter(settings, roots);
  if (!frontmatter) {
    return {
      settings: ignored,
      message,
      detail: `A daily note template cannot keep daily notes outside the workspace, where foam.openDailyNote.directory puts them. Move them into the workspace and set the daily note template's filepath, or ${useDefault}`,
      fix: { kind: 'none' },
    };
  }
  if (template) {
    return {
      settings: ignored,
      message,
      detail: `To keep daily notes where they were, add this to the daily note template's frontmatter:\n\n${frontmatter}\n\nOr ${useDefault}`,
      fix: { kind: 'add-filepath' },
    };
  }
  const keeping = templateWith(frontmatter, settings);
  return {
    settings: ignored,
    message,
    detail: `Saved as daily-note.md in the templates folder, this daily note template keeps creating daily notes as before:\n\n${keeping}\nOr ${useDefault}`,
    fix: { kind: 'create-template', template: keeping },
  };
}

/**
 * The folder the settings put daily notes in, by the rule that wrote them. A
 * file in it is resolved rather than the folder, which on its own would name
 * a root instead of a folder inside it.
 */
function legacyDailyNoteFolder(directory: string, roots: URI[]): URI {
  return asAbsoluteUri(
    joinPath(directory.replace(/\\/g, '/'), 'note'),
    roots
  ).getDirectory();
}

/**
 * The daily-note template `filepath` that places daily notes where the
 * settings did, with the old defaults for the settings that are not set.
 * `undefined` when the settings put them outside every workspace root: a
 * template `filepath` always resolves inside the workspace.
 */
export function legacyDailyNoteFilepath(
  settings: LegacyDailyNoteSettings,
  roots: URI[]
): string | undefined {
  const folder = legacyDailyNoteFolder(
    settings.directory ?? DEFAULT_DAILY_NOTE_DIRECTORY,
    roots
  );
  const root = roots.find(root => isPathWithin(folder.path, root.path));
  if (!root) {
    return undefined;
  }
  // A template filepath starting with `/` resolves into the root its first
  // segment names, else into the first root, so the root is named unless
  // that already lands in it
  const relative = relativeTo(folder.path, root.path);
  const namesRoot =
    root !== roots[0] ||
    findRootByName(relative.split('/')[0], roots) !== undefined;
  const segments = [namesRoot ? getBasename(root.path) : '', relative].filter(
    segment => segment !== ''
  );
  return `/${segments.map(segment => `${segment}/`).join('')}${dateVariable(
    settings.filenameFormat ?? 'isoDate'
  )}.${settings.fileExtension ?? 'md'}`;
}

/**
 * The `foam_template` frontmatter that places daily notes where the settings
 * did, or `undefined` when no template can (see {@link legacyDailyNoteFilepath}).
 */
export function legacyDailyNoteFrontmatter(
  settings: LegacyDailyNoteSettings,
  roots: URI[]
): string | undefined {
  // Single-quoted, so YAML leaves the backslashes of escapes in the format alone
  const filepath = legacyDailyNoteFilepath(settings, roots)?.replace(
    /'/g,
    "''"
  );
  return filepath && `foam_template:\n  filepath: '${filepath}'`;
}

/**
 * A daily-note template that creates daily notes where and as the settings
 * did: placed by them, holding only a heading with the date formatted by
 * `titleFormat`, else `filenameFormat`. `undefined` when no template can
 * place them there (see {@link legacyDailyNoteFilepath}).
 */
export function legacyDailyNoteTemplate(
  settings: LegacyDailyNoteSettings,
  roots: URI[]
): string | undefined {
  const frontmatter = legacyDailyNoteFrontmatter(settings, roots);
  return frontmatter && templateWith(frontmatter, settings);
}

function templateWith(
  frontmatter: string,
  settings: LegacyDailyNoteSettings
): string {
  const titleFormat =
    settings.titleFormat ?? settings.filenameFormat ?? 'isoDate';
  return `---\n${frontmatter}\n---\n# ${dateVariable(titleFormat)}\n`;
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

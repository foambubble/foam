import dayjs from 'dayjs';
import { IFoamConfig } from '../config';
import { convertDateformatToDayjs } from '../utils/date-format';
import { joinPath } from '../utils/path';
import {
  PatternPart,
  partsFromDailyNoteSettings,
  partsFromTemplateFilepath,
} from './daily-note-path-pattern';
import { Template } from './note-creation-types';

/**
 * Where daily notes go when neither the daily-note template nor the
 * `openDailyNote.*` settings say otherwise. It matches the folder of
 * {@link DEFAULT_DAILY_NOTE_TEMPLATE}, so creating that template does not move
 * where daily notes land.
 */
export const DEFAULT_DAILY_NOTE_DIRECTORY = 'journal';

/** The template Foam offers to write when a workspace has none. */
export const DEFAULT_DAILY_NOTE_TEMPLATE = `---
foam_template:
  filepath: "/${DEFAULT_DAILY_NOTE_DIRECTORY}/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
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
 * The deprecated `foam.openDailyNote.*` settings. `directory` is `null` when
 * the setting is absent, which is what selects the default directory;
 * `titleFormat` is `null` when absent, which titles notes by `filenameFormat`.
 */
export interface DailyNoteSettings {
  directory: string | null;
  filenameFormat: string;
  fileExtension: string;
  titleFormat: string | null;
}

export function dailyNoteSettings(config: IFoamConfig): DailyNoteSettings {
  return {
    directory: config.getDailyNoteDirectory(),
    filenameFormat: config.getDailyNoteFilenameFormat(),
    fileExtension: config.getDailyNoteFileExtension(),
    titleFormat: config.getDailyNoteTitleFormat(),
  };
}

/**
 * Which source places daily notes. A JavaScript template computes its path as
 * it runs, so nothing outside that run can know where its notes are.
 */
export type DailyNoteRule = 'template' | 'settings' | 'default' | 'unavailable';

export function dailyNoteRule(
  template: Template | undefined,
  settings: DailyNoteSettings
): DailyNoteRule {
  if (template?.type === 'javascript') {
    return 'unavailable';
  }
  if (template?.metadata.get('filepath')) {
    return 'template';
  }
  return settings.directory === null ? 'default' : 'settings';
}

/**
 * Where the settings put the daily note for `date`, relative to the workspace
 * root. Used whenever the template does not set a `filepath`.
 */
export function dailyNoteSettingsPath(
  date: Date,
  settings: DailyNoteSettings
): string {
  const name = dayjs(date).format(
    convertDateformatToDayjs(settings.filenameFormat)
  );
  return joinPath(
    settings.directory ?? DEFAULT_DAILY_NOTE_DIRECTORY,
    `${name}.${settings.fileExtension}`
  );
}

/**
 * The pattern daily notes follow, for recognising them among workspace paths.
 * The template's `filepath` wins outright over the settings — it is what
 * actually writes the note. `undefined` when the pattern cannot be read back
 * (see `daily-note-path-pattern.ts`), including for a JavaScript template:
 * reading the settings instead would point at paths that template never
 * writes to.
 */
export function dailyNotePattern(
  template: Template | undefined,
  settings: DailyNoteSettings
): PatternPart[] | undefined {
  if (template?.type === 'javascript') {
    return undefined;
  }
  const templateFilepath = template?.metadata.get('filepath');
  return templateFilepath
    ? partsFromTemplateFilepath(templateFilepath)
    : partsFromDailyNoteSettings(
        settings.directory ?? DEFAULT_DAILY_NOTE_DIRECTORY,
        settings.filenameFormat,
        settings.fileExtension
      );
}

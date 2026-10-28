import dayjs from 'dayjs';
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

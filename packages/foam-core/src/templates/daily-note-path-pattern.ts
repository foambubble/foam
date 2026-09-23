import { SnippetParser, Text, Variable } from '../common/snippetParser';
import { convertDateformatToDayjs } from '../utils/date-format';
import { joinPath } from '../utils/path';
import { DEFAULT_FOAM_DATE_FORMAT } from './variable-resolver';

/**
 * Recognizing a daily note means inverting the pattern that writes one: the
 * same definition that decides where a daily note goes decides which existing
 * paths are daily notes. A pattern is parsed into parts, and the parts are
 * turned into a regex whose capture groups give the date back.
 *
 * A pattern is only invertible if it spells out year, month and day in
 * numbers. A month name is locale-dependent, and a day name or week number
 * does not name a day on its own, so those make the whole pattern
 * unsupported rather than approximate.
 */

/** A date token we can both format with and read back. */
export type DateToken = 'YYYY' | 'YY' | 'MM' | 'M' | 'DD' | 'D';

export type PatternPart =
  | { kind: 'literal'; text: string }
  | { kind: 'date'; token: DateToken };

type DateUnit = 'year' | 'month' | 'day';

const TOKEN_UNIT: Record<DateToken, DateUnit> = {
  YYYY: 'year',
  YY: 'year',
  MM: 'month',
  M: 'month',
  DD: 'day',
  D: 'day',
};

const TOKEN_REGEX: Record<DateToken, string> = {
  YYYY: '\\d{4}',
  YY: '\\d{2}',
  MM: '\\d{2}',
  M: '\\d{1,2}',
  DD: '\\d{2}',
  D: '\\d{1,2}',
};

/**
 * Variables a daily note filepath can be built from, and the date format each
 * one stands for. `FOAM_TITLE` counts as a date part because both daily-note
 * flows set it to the formatted date before resolving.
 */
const VARIABLE_FORMAT = new Map<string, string>([
  ['FOAM_TITLE', 'YYYY-MM-DD'],
  ['FOAM_DATE_YEAR', 'YYYY'],
  ['FOAM_DATE_YEAR_SHORT', 'YY'],
  ['FOAM_DATE_MONTH', 'MM'],
  ['FOAM_DATE_DATE', 'DD'],
]);

/**
 * Parses a dayjs format string into pattern parts, honouring dayjs's own
 * `[literal]` escape. Returns `undefined` for any token that is not a numeric
 * year, month or day.
 */
export function partsFromDayjsFormat(
  format: string
): PatternPart[] | undefined {
  const parts: PatternPart[] = [];
  let literal = '';
  const flushLiteral = () => {
    if (literal.length > 0) {
      parts.push({ kind: 'literal', text: literal });
      literal = '';
    }
  };

  let i = 0;
  while (i < format.length) {
    const char = format[i];
    if (char === '[') {
      const end = format.indexOf(']', i + 1);
      if (end === -1) {
        return undefined;
      }
      literal += format.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      // dayjs tokens are runs of the same letter
      let end = i;
      while (end < format.length && format[end] === char) {
        end++;
      }
      const token = format.slice(i, end);
      if (!(token in TOKEN_UNIT)) {
        return undefined;
      }
      flushLiteral();
      parts.push({ kind: 'date', token: token as DateToken });
      i = end;
      continue;
    }
    literal += char;
    i++;
  }
  flushLiteral();
  return parts;
}

/**
 * Parses a template's `foam_template.filepath` into pattern parts. Parsing
 * goes through {@link SnippetParser} rather than a regex over `${...}` so
 * `$FOAM_DATE_YEAR`, `${FOAM_DATE_YEAR}` and `${FOAM_DATE_FORMAT:YYYY-MM-DD}`
 * are read the way resolution reads them.
 */
export function partsFromTemplateFilepath(
  filepath: string
): PatternPart[] | undefined {
  const snippet = new SnippetParser().parse(filepath, false, false);
  const parts: PatternPart[] = [];
  for (const marker of snippet.children) {
    if (marker instanceof Text) {
      parts.push({ kind: 'literal', text: marker.value });
      continue;
    }
    if (marker instanceof Variable) {
      const expanded = expandVariable(marker);
      if (!expanded) {
        return undefined;
      }
      parts.push(...expanded);
      continue;
    }
    return undefined;
  }
  return parts;
}

function expandVariable(variable: Variable): PatternPart[] | undefined {
  if (variable.name === 'FOAM_DATE_FORMAT') {
    const format = variable.children.map(child => child.toString()).join('');
    return partsFromDayjsFormat(format || DEFAULT_FOAM_DATE_FORMAT);
  }
  const format = VARIABLE_FORMAT.get(variable.name);
  return format ? partsFromDayjsFormat(format) : undefined;
}

/**
 * Parses the deprecated `openDailyNote.*` settings into pattern parts. The
 * directory is resolved against the workspace root, matching how the settings
 * build a daily note's URI.
 */
export function partsFromDailyNoteSettings(
  directory: string,
  filenameFormat: string,
  fileExtension: string
): PatternPart[] | undefined {
  const nameParts = partsFromDayjsFormat(
    convertDateformatToDayjs(filenameFormat)
  );
  if (!nameParts) {
    return undefined;
  }
  // Normalized the way `joinPath` normalizes it when a daily note is written,
  // so `journal`, `./journal` and `notes/../journal` all name the same folder.
  let dir = joinPath(directory.replace(/\\/g, '/'));
  while (dir.length > 1 && dir.endsWith('/')) {
    dir = dir.slice(0, -1);
  }
  const prefix =
    dir === '.' || dir === '/'
      ? '/'
      : dir.startsWith('/')
      ? `${dir}/`
      : `/${dir}/`;
  return [
    { kind: 'literal', text: prefix },
    ...nameParts,
    { kind: 'literal', text: `.${fileExtension}` },
  ];
}

/**
 * Turns pattern parts into a function that reads a date back out of a
 * workspace-relative path, or `undefined` when the pattern cannot name a day
 * — the case where the feature is unavailable for the workspace.
 */
export function dailyNotePathMatcher(
  parts: PatternPart[]
): ((path: string) => Date | undefined) | undefined {
  const groups: { unit: DateUnit; token: DateToken }[] = [];
  let source = '';
  for (const part of parts) {
    if (part.kind === 'literal') {
      source += escapeRegex(part.text);
      continue;
    }
    groups.push({ unit: TOKEN_UNIT[part.token], token: part.token });
    source += `(${TOKEN_REGEX[part.token]})`;
  }

  const units: DateUnit[] = ['year', 'month', 'day'];
  if (!units.every(unit => groups.some(group => group.unit === unit))) {
    return undefined;
  }

  // An absolute pattern is resolved against the workspace root, so it matches
  // the whole relative path. A relative one is resolved against the root or
  // the current editor's directory depending on `files.newNotePath`, so its
  // prefix is not knowable and it only anchors at the end, on a `/` boundary.
  const isAbsolute =
    parts[0].kind === 'literal' && parts[0].text.startsWith('/');
  const regex = new RegExp(isAbsolute ? `^${source}$` : `(?:^|/)${source}$`);

  return (path: string): Date | undefined => {
    const match = regex.exec(path);
    if (!match) {
      return undefined;
    }
    const values = new Map<DateUnit, number>();
    for (const [index, group] of groups.entries()) {
      const raw = Number(match[index + 1]);
      // `YY` reads as the 2000s, the century dayjs assumes when formatting it
      const value = group.token === 'YY' ? 2000 + raw : raw;
      if (values.has(group.unit) && values.get(group.unit) !== value) {
        return undefined; // the same unit captured twice with different values
      }
      values.set(group.unit, value);
    }
    const year = values.get('year');
    const month = values.get('month');
    const day = values.get('day');
    const date = new Date(year, month - 1, day);
    // A pattern matches dates the calendar does not have, e.g. 2026-02-31
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
      ? date
      : undefined;
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

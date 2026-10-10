/** A link to a day's note, and where it sits in the text it was found in. */
export interface DayLink {
  day: string;
  start: number;
  end: number;
}

const WIKILINK = /(!?)\[\[([^[\]]+)\]\]/g;
const BACKTICKS = /`+/g;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The links to a day in `text`: wikilinks, not embeds nor in inline code,
 * whose target's last segment is a date that exists, with or without a
 * folder, section or alias.
 */
export function dayLinksIn(text: string): DayLink[] {
  const links: DayLink[] = [];
  for (const match of withoutInlineCode(text).matchAll(WIKILINK)) {
    if (match[1] === '!') {
      continue;
    }
    const target = match[2].split('|')[0].split('#')[0];
    const day = target.slice(target.lastIndexOf('/') + 1);
    if (isDay(day)) {
      links.push({
        day,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return links;
}

/**
 * `text` with its inline code blanked, keeping every offset. As remark-parse 8
 * reads it, a run of backticks opens code that the next run of exactly as
 * many closes; a run that none closes is read again from its next backtick.
 */
function withoutInlineCode(text: string): string {
  const runs = [...text.matchAll(BACKTICKS)].map(match => ({
    start: match.index,
    length: match[0].length,
  }));
  // The runs of each length, and how many of them are behind the reading.
  const byLength = new Map<number, number[]>();
  runs.forEach(({ length }, i) => {
    const same = byLength.get(length) ?? [];
    same.push(i);
    byLength.set(length, same);
  });
  const behind = new Map<number, number>();
  /** The first run after the run at `after` that is `length` long; -1 with none. */
  const closing = (after: number, length: number): number => {
    const same = byLength.get(length) ?? [];
    let next = behind.get(length) ?? 0;
    while (next < same.length && same[next] <= after) {
      next++;
    }
    behind.set(length, next);
    return next < same.length ? same[next] : -1;
  };
  let blanked = '';
  let copied = 0;
  for (let i = 0; i < runs.length; i++) {
    const { start, length } = runs[i];
    for (let open = length; open > 0; open--) {
      const close = closing(i, open);
      if (close !== -1) {
        const from = start + length - open;
        const to = runs[close].start + open;
        blanked += text.slice(copied, from) + ' '.repeat(to - from);
        copied = to;
        i = close;
        break;
      }
    }
  }
  return blanked + text.slice(copied);
}

/** Whether `text` is a date that exists, as `YYYY-MM-DD`. */
export function isDay(text: string): boolean {
  const parts = DAY.exec(text);
  if (!parts) {
    return false;
  }
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Whitespace after the last character of a line's text, `\r` included. */
const TRAILING = ' \t\r';

/** Where the run of `chars` that `text` ends with starts. */
function trailingStart(text: string, chars: string): number {
  let start = text.length;
  while (start > 0 && chars.includes(text[start - 1])) {
    start--;
  }
  return start;
}

/**
 * `line` scheduled for `to`, having been shown under `from` (null when it was
 * shown under no day). The links to `from` are moved to `to`; when the line
 * links no `from`, a `[[to]]` link is appended after its text. A line that
 * already links `to` loses its links to `from` instead, and moving to `from`
 * itself changes nothing.
 */
export function scheduleLine(
  line: string,
  from: string | null,
  to: string
): string {
  if (from === to) {
    return line;
  }
  const links = dayLinksIn(line);
  const linksFrom = from !== null && links.some(link => link.day === from);
  if (links.some(link => link.day === to)) {
    return linksFrom ? removeDayLink(line, from) : line;
  }
  if (!linksFrom) {
    const end = trailingStart(line, TRAILING);
    return `${line.slice(0, end)} [[${to}]]${line.slice(end)}`;
  }
  let moved = line;
  for (const link of links.filter(l => l.day === from).reverse()) {
    moved =
      moved.slice(0, link.start) +
      moved.slice(link.start, link.end).split(from).join(to) +
      moved.slice(link.end);
  }
  return moved;
}

/**
 * `line` without its links to `day`. A link that ends the text goes with the
 * whitespace before it, any other with the space after it, so that removing
 * what {@link scheduleLine} appended gives back the line as it was.
 */
export function removeDayLink(line: string, day: string): string {
  let text = line;
  for (const link of dayLinksIn(line)
    .filter(l => l.day === day)
    .reverse()) {
    text = withoutRange(text, link.start, link.end);
  }
  return text;
}

/**
 * `text` without its day links, for showing a task whose day is shown apart;
 * `text` as it is when nothing else would be left.
 */
export function withoutDayLinks(text: string): string {
  let shown = text;
  for (const link of dayLinksIn(text).reverse()) {
    shown = withoutRange(shown, link.start, link.end);
  }
  return shown.trim() === '' ? text : shown;
}

function withoutRange(text: string, start: number, end: number): string {
  const after = text.slice(end);
  if (trailingStart(after, TRAILING) === 0) {
    const before = text.slice(0, start);
    return before.slice(0, trailingStart(before, ' \t')) + after;
  }
  return text.slice(0, start) + after.replace(/^ /, '');
}

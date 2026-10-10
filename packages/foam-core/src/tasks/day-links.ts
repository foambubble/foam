/** A link to a day's note, and where it sits in the text it was found in. */
export interface DayLink {
  day: string;
  start: number;
  end: number;
}

const WIKILINK = /(!?)\[\[([^[\]]+)\]\]/g;
const CODE_SPAN = /(`+)[\s\S]*?\1/g;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The links to a day in `text`: wikilinks, not embeds nor in inline code,
 * whose target's last segment is a date that exists, with or without a
 * folder, section or alias.
 */
export function dayLinksIn(text: string): DayLink[] {
  const links: DayLink[] = [];
  // Inline code holds no links; blanking it keeps every offset.
  const scanned = text.replace(CODE_SPAN, span => ' '.repeat(span.length));
  for (const match of scanned.matchAll(WIKILINK)) {
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
const TRAILING = /[ \t\r]*$/;

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
    const end = line.length - TRAILING.exec(line)![0].length;
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
  if (TRAILING.exec(after)![0].length === after.length) {
    const before = text.slice(0, start).replace(/[ \t]+$/, '');
    return before + after;
  }
  return text.slice(0, start) + after.replace(/^ /, '');
}

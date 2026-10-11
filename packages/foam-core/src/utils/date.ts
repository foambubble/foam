const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The date `year`-`month`-`day`, month from 1, at local midnight; undefined
 * when the calendar has no such day, e.g. 2026-02-31.
 */
export function calendarDate(
  year: number,
  month: number,
  day: number
): Date | undefined {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}

/**
 * The date `text` names as `YYYY-MM-DD`, at local midnight; undefined when it
 * names none.
 */
export function parseIsoDate(text: string): Date | undefined {
  const parts = ISO_DATE.exec(text);
  if (!parts) {
    return undefined;
  }
  const [year, month, day] = parts.slice(1).map(Number);
  return calendarDate(year, month, day);
}

/** `date`'s day in local time, as `YYYY-MM-DD`. */
export function formatIsoDate(date: Date): string {
  const pad = (value: number, width: number) =>
    String(value).padStart(width, '0');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(
    date.getDate(),
    2
  )}`;
}

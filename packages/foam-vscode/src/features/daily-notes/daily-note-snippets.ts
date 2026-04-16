export interface DailyNoteSnippet {
  trigger: string;
  date: Date;
  description: string;
}

const DAYS_OF_WEEK = [
  { name: 'sunday', index: 0 },
  { name: 'monday', index: 1 },
  { name: 'tuesday', index: 2 },
  { name: 'wednesday', index: 3 },
  { name: 'thursday', index: 4 },
  { name: 'friday', index: 5 },
  { name: 'saturday', index: 6 },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns the next occurrence of the given day of the week on or after the reference date.
 * If the reference date is already the target day, returns it unchanged (distance 0).
 */
function nextOccurrenceOf(referenceDate: Date, dayIndex: number): Date {
  const distance = (dayIndex + 7 - referenceDate.getDay()) % 7;
  return addDays(referenceDate, distance);
}

/**
 * Returns the most recent past occurrence of the given day of the week before the reference date.
 * If the reference date is already the target day, goes back a full week.
 */
function lastOccurrenceOf(referenceDate: Date, dayIndex: number): Date {
  const currentDay = referenceDate.getDay();
  const distance = currentDay === dayIndex ? 7 : (7 + currentDay - dayIndex) % 7;
  return addDays(referenceDate, -distance);
}

export function getFixedSnippets(referenceDate: Date): DailyNoteSnippet[] {
  return [
    {
      trigger: '/day',
      description: "Insert a link to today's daily note",
      date: referenceDate,
    },
    {
      trigger: '/today',
      description: "Insert a link to today's daily note",
      date: referenceDate,
    },
    {
      trigger: '/tomorrow',
      description: "Insert a link to tomorrow's daily note",
      date: addDays(referenceDate, 1),
    },
    {
      trigger: '/yesterday',
      description: "Insert a link to yesterday's daily note",
      date: addDays(referenceDate, -1),
    },
  ];
}

export function getDayOfWeekSnippets(referenceDate: Date): DailyNoteSnippet[] {
  const future = DAYS_OF_WEEK.map(({ name, index }) => ({
    trigger: `/${name}`,
    description: `Get a daily note link for ${name}`,
    date: nextOccurrenceOf(referenceDate, index),
  }));

  const past = DAYS_OF_WEEK.map(({ name, index }) => ({
    trigger: `/-${name}`,
    description: `Get a daily note link for last ${name}`,
    date: lastOccurrenceOf(referenceDate, index),
  }));

  return [...future, ...past];
}

export function getRelativeSnippet(
  referenceDate: Date,
  unit: 'd' | 'w' | 'm' | 'y',
  n: number
): DailyNoteSnippet {
  switch (unit) {
    case 'd':
      return {
        trigger: `/+${n}d`,
        description: `Insert a date ${n} day(s) from now`,
        date: addDays(referenceDate, n),
      };
    case 'w':
      return {
        trigger: `/+${n}w`,
        description: `Insert a date ${n} week(s) from now`,
        date: addDays(referenceDate, 7 * n),
      };
    case 'm':
      return {
        trigger: `/+${n}m`,
        description: `Insert a date ${n} month(s) from now`,
        date: new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth() + n,
          referenceDate.getDate()
        ),
      };
    case 'y':
      return {
        trigger: `/+${n}y`,
        description: `Insert a date ${n} year(s) from now`,
        date: new Date(
          referenceDate.getFullYear() + n,
          referenceDate.getMonth(),
          referenceDate.getDate()
        ),
      };
  }
}

import { calendarDate, formatIsoDate, parseIsoDate } from './date';

describe('calendarDate', () => {
  it('is the date at local midnight, month from 1', () => {
    expect(calendarDate(2026, 10, 9)).toEqual(new Date(2026, 9, 9));
  });

  it('is undefined for a day the calendar does not have', () => {
    expect(calendarDate(2026, 2, 29)).toBeUndefined();
    expect(calendarDate(2026, 2, 31)).toBeUndefined();
    expect(calendarDate(2026, 13, 1)).toBeUndefined();
    expect(calendarDate(2026, 0, 1)).toBeUndefined();
  });

  it('takes a leap day in a leap year', () => {
    expect(calendarDate(2028, 2, 29)).toEqual(new Date(2028, 1, 29));
  });
});

describe('parseIsoDate', () => {
  it('reads YYYY-MM-DD as a date at local midnight', () => {
    expect(parseIsoDate('2026-10-09')).toEqual(new Date(2026, 9, 9));
  });

  it('is undefined for other text, or a date that does not exist', () => {
    for (const text of [
      '2026-10-9',
      '26-10-09',
      '2026-10-09 notes',
      'x2026-10-09',
      '2026-02-30',
      '2026-13-01',
    ]) {
      expect(parseIsoDate(text)).toBeUndefined();
    }
  });
});

describe('formatIsoDate', () => {
  it("writes the date's local day as YYYY-MM-DD, whatever its time", () => {
    expect(formatIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('pads the year to four digits', () => {
    const date = new Date(2026, 9, 9);
    date.setFullYear(987);
    expect(formatIsoDate(date)).toBe('0987-10-09');
  });

  it('reads back what it writes', () => {
    const date = new Date(2026, 11, 31);
    expect(parseIsoDate(formatIsoDate(date))).toEqual(date);
  });
});

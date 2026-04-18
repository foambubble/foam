import {
  getDayOfWeekSnippets,
  getFixedSnippets,
  getRelativeSnippet,
} from './daily-note-snippets';

// Wednesday 17 January 2024 (day index 3) is the reference date for all tests.
const ANCHOR = new Date(2024, 0, 17);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const offsetDate = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

describe('getFixedSnippets', () => {
  it('returns 4 snippets', () => {
    expect(getFixedSnippets(ANCHOR)).toHaveLength(4);
  });

  it('/today returns the reference date', () => {
    const s = getFixedSnippets(ANCHOR).find(s => s.trigger === '/today');
    expect(sameDay(s.date, ANCHOR)).toBe(true);
  });

  it('/day returns the reference date', () => {
    const s = getFixedSnippets(ANCHOR).find(s => s.trigger === '/day');
    expect(sameDay(s.date, ANCHOR)).toBe(true);
  });

  it('/tomorrow returns the day after the reference date', () => {
    const s = getFixedSnippets(ANCHOR).find(s => s.trigger === '/tomorrow');
    expect(sameDay(s.date, offsetDate(ANCHOR, 1))).toBe(true);
  });

  it('/yesterday returns the day before the reference date', () => {
    const s = getFixedSnippets(ANCHOR).find(s => s.trigger === '/yesterday');
    expect(sameDay(s.date, offsetDate(ANCHOR, -1))).toBe(true);
  });
});

describe('getDayOfWeekSnippets', () => {
  it('produces exactly 14 snippets (7 future + 7 past)', () => {
    expect(getDayOfWeekSnippets(ANCHOR)).toHaveLength(14);
  });

  it('future snippets have triggers of the form /day', () => {
    const future = getDayOfWeekSnippets(ANCHOR).slice(0, 7);
    for (const s of future) {
      expect(s.trigger).toMatch(/^\/[a-z]+$/);
    }
  });

  it('past snippets have triggers of the form /-day', () => {
    const past = getDayOfWeekSnippets(ANCHOR).slice(7);
    for (const s of past) {
      expect(s.trigger).toMatch(/^\/-[a-z]+$/);
    }
  });

  describe('future targets', () => {
    it('/wednesday on a Wednesday returns today (distance 0)', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/wednesday');
      expect(sameDay(s.date, ANCHOR)).toBe(true);
    });

    it('/thursday on a Wednesday returns the next day', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/thursday');
      expect(sameDay(s.date, offsetDate(ANCHOR, 1))).toBe(true);
    });

    it('/monday on a Wednesday returns 5 days ahead', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/monday');
      expect(sameDay(s.date, offsetDate(ANCHOR, 5))).toBe(true);
    });

    it('/tuesday on a Wednesday returns 6 days ahead', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/tuesday');
      expect(sameDay(s.date, offsetDate(ANCHOR, 6))).toBe(true);
    });
  });

  describe('past targets', () => {
    it('/-wednesday on a Wednesday returns 7 days ago (not today)', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-wednesday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -7))).toBe(true);
    });

    it('/-tuesday on a Wednesday returns 1 day ago', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-tuesday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -1))).toBe(true);
    });

    it('/-monday on a Wednesday returns 2 days ago', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-monday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -2))).toBe(true);
    });

    it('/-sunday on a Wednesday returns 3 days ago', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-sunday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -3))).toBe(true);
    });

    it('/-saturday on a Wednesday returns 4 days ago', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-saturday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -4))).toBe(true);
    });

    it('/-friday on a Wednesday returns 5 days ago', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-friday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -5))).toBe(true);
    });

    it('/-thursday on a Wednesday returns 6 days ago', () => {
      const s = getDayOfWeekSnippets(ANCHOR).find(s => s.trigger === '/-thursday');
      expect(sameDay(s.date, offsetDate(ANCHOR, -6))).toBe(true);
    });
  });
});

describe('getRelativeSnippet', () => {
  it('/+3d returns 3 days from the reference date', () => {
    const s = getRelativeSnippet(ANCHOR, 'd', 3);
    expect(s.trigger).toBe('/+3d');
    expect(sameDay(s.date, offsetDate(ANCHOR, 3))).toBe(true);
  });

  it('/+2w returns 14 days from the reference date', () => {
    const s = getRelativeSnippet(ANCHOR, 'w', 2);
    expect(s.trigger).toBe('/+2w');
    expect(sameDay(s.date, offsetDate(ANCHOR, 14))).toBe(true);
  });

  it('/+1m returns 1 month from the reference date', () => {
    const s = getRelativeSnippet(ANCHOR, 'm', 1);
    expect(s.trigger).toBe('/+1m');
    const expected = new Date(
      ANCHOR.getFullYear(),
      ANCHOR.getMonth() + 1,
      ANCHOR.getDate()
    );
    expect(sameDay(s.date, expected)).toBe(true);
  });

  it('/+1y returns 1 year from the reference date', () => {
    const s = getRelativeSnippet(ANCHOR, 'y', 1);
    expect(s.trigger).toBe('/+1y');
    const expected = new Date(
      ANCHOR.getFullYear() + 1,
      ANCHOR.getMonth(),
      ANCHOR.getDate()
    );
    expect(sameDay(s.date, expected)).toBe(true);
  });

  it('trigger reflects the requested number', () => {
    expect(getRelativeSnippet(ANCHOR, 'd', 7).trigger).toBe('/+7d');
    expect(getRelativeSnippet(ANCHOR, 'w', 3).trigger).toBe('/+3w');
  });
});

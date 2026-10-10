import {
  dayLinksIn,
  removeDayLink,
  scheduleLine,
  withoutDayLinks,
} from './day-links';

describe('dayLinksIn', () => {
  it('finds day links with a folder, a section or an alias', () => {
    const text =
      'a [[2026-10-08]] b [[journal/2026-10-09]] c [[2026-10-10#Log]] d [[2026-10-11|Sunday]]';

    expect(dayLinksIn(text).map(link => link.day)).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });

  it('gives where each link starts and ends', () => {
    const text = 'Call [[2026-10-08]] now';
    const [link] = dayLinksIn(text);

    expect(text.slice(link.start, link.end)).toBe('[[2026-10-08]]');
  });

  it('ignores links inside inline code', () => {
    expect(
      dayLinksIn(
        'see `[[2026-10-08]]` and ``x [[2026-10-10]]`` then [[2026-10-09]]'
      ).map(link => link.day)
    ).toEqual(['2026-10-09']);
  });

  it('ends inline code only at a run of as many backticks as opened it', () => {
    expect(dayLinksIn('`` [[2026-10-09]] ```').map(l => l.day)).toEqual([
      '2026-10-09',
    ]);
    expect(dayLinksIn('```a`` [[2026-10-09]] `` b').map(l => l.day)).toEqual([
      '2026-10-09',
    ]);
  });

  it('opens inline code from the next backtick of a run that nothing closes', () => {
    expect(dayLinksIn('``` [[2026-10-09]] `')).toEqual([]);
  });

  it('finds a day link after an unclosed [[', () => {
    expect(dayLinksIn('see [[ syntax [[2026-10-09]]').map(l => l.day)).toEqual([
      '2026-10-09',
    ]);
    expect(dayLinksIn('[[2026-10-09# [[2026-10-10]]').map(l => l.day)).toEqual([
      '2026-10-10',
    ]);
  });

  it('ignores embeds, other notes, and dates that do not exist', () => {
    const text =
      '![[2026-10-08]] [[zettelkasten]] [[2026-02-30]] [[2026-13-01]] [[2026-10-08 notes]] [[x2026-10-08]]';

    expect(dayLinksIn(text)).toEqual([]);
  });
});

describe('M6 AC-2: scheduling changes only the date link on the line', () => {
  it('appends a link to the day when the line has none', () => {
    expect(scheduleLine('- [ ] Send review notes', null, '2026-10-09')).toBe(
      '- [ ] Send review notes [[2026-10-09]]'
    );
  });

  it('appends before trailing whitespace, which stays where it was', () => {
    expect(scheduleLine('- [ ] Hard break  ', null, '2026-10-09')).toBe(
      '- [ ] Hard break [[2026-10-09]]  '
    );
    expect(scheduleLine('- [ ] ', null, '2026-10-09')).toBe(
      '- [ ] [[2026-10-09]] '
    );
  });

  it('replaces the link to the day the task was shown under', () => {
    expect(
      scheduleLine(
        '- [ ] Send review notes [[2026-10-07]] to the team',
        '2026-10-07',
        '2026-10-08'
      )
    ).toBe('- [ ] Send review notes [[2026-10-08]] to the team');
  });

  it('keeps the link folder, section and alias, and the other day links', () => {
    expect(
      scheduleLine(
        '- [ ] Book [[journal/2026-10-07#Log|2026-10-07]] [[2026-10-12]]',
        '2026-10-07',
        '2026-10-08'
      )
    ).toBe('- [ ] Book [[journal/2026-10-08#Log|2026-10-08]] [[2026-10-12]]');
  });

  it('removes the shown day instead when the line already links the new one', () => {
    expect(
      scheduleLine(
        '- [ ] Book [[2026-10-07]] [[2026-10-12]]',
        '2026-10-07',
        '2026-10-12'
      )
    ).toBe('- [ ] Book [[2026-10-12]]');
  });

  it('changes nothing when the day is the one shown', () => {
    const line = '- [ ] Book [[2026-10-07]]';
    expect(scheduleLine(line, '2026-10-07', '2026-10-07')).toBe(line);
  });

  it('appends when the task was shown under a day it does not link', () => {
    expect(
      scheduleLine('- [ ] In a daily note', '2026-10-07', '2026-10-08')
    ).toBe('- [ ] In a daily note [[2026-10-08]]');
  });

  it('changes nothing when an undated task is scheduled to the day it is in', () => {
    // A daily note's own task already has the note's day.
    expect(scheduleLine('- [ ] Mine', '2026-10-07', '2026-10-07')).toBe(
      '- [ ] Mine'
    );
  });
});

describe('M6 AC-3: Remove date returns the line to its bytes before scheduling', () => {
  const lines = [
    '- [ ] Send review notes',
    '- [ ] Hard break  ',
    '- [ ] Tab\t',
    '- [ ] ',
    '  * [x] Nested [[zettelkasten]] done',
    '- [ ] Already [[2026-10-12]] linked',
    '- [ ] Unicode — ünïcode 🧠',
    '- [ ] see [[ syntax',
    '- [ ] [[2026-10-09#',
  ];

  it.each(lines)('round-trips %j', line => {
    const scheduled = scheduleLine(line, null, '2026-10-09');

    expect(scheduled).not.toBe(line);
    expect(removeDayLink(scheduled, '2026-10-09')).toBe(line);
  });

  it('round-trips a rescheduled task back to its first day', () => {
    const line = '- [ ] Call [[2026-10-07]] about it';
    const moved = scheduleLine(line, '2026-10-07', '2026-10-09');

    expect(scheduleLine(moved, '2026-10-09', '2026-10-07')).toBe(line);
  });
});

describe('removeDayLink', () => {
  it('removes a link in the middle with the space after it', () => {
    expect(
      removeDayLink('- [ ] Call [[2026-10-07]] about it', '2026-10-07')
    ).toBe('- [ ] Call about it');
  });

  it('removes a link right after the checkbox with the space after it', () => {
    expect(removeDayLink('- [ ] [[2026-10-07]] Call', '2026-10-07')).toBe(
      '- [ ] Call'
    );
  });

  it('removes every link to that day and leaves the others', () => {
    expect(
      removeDayLink(
        '- [ ] a [[2026-10-07]] b [[2026-10-08]] [[journal/2026-10-07]]',
        '2026-10-07'
      )
    ).toBe('- [ ] a b [[2026-10-08]]');
  });

  it('leaves a line without a link to that day as it is', () => {
    const line = '- [ ] a [[2026-10-08]]';
    expect(removeDayLink(line, '2026-10-07')).toBe(line);
  });
});

describe('withoutDayLinks', () => {
  it('hides the day links and keeps the other links', () => {
    expect(
      withoutDayLinks('Return [[How to Take Smart Notes]] [[2026-10-08]]')
    ).toBe('Return [[How to Take Smart Notes]]');
  });

  it('keeps the text as written when it is nothing but day links', () => {
    expect(withoutDayLinks('[[2026-10-08]]')).toBe('[[2026-10-08]]');
    expect(withoutDayLinks(' [[2026-10-08]] [[2026-10-09]]')).toBe(
      ' [[2026-10-08]] [[2026-10-09]]'
    );
  });

  it('hides several days', () => {
    expect(withoutDayLinks('Book [[2026-10-09]] [[2026-10-12]] now')).toBe(
      'Book now'
    );
  });
});

describe('long lines', () => {
  const tabs = '\t'.repeat(100_000);

  it.each([
    [
      'finding day links after a run of backticks',
      () => dayLinksIn('`'.repeat(100_000)),
    ],
    [
      'scheduling a task ending in a run of tabs and a word',
      () => scheduleLine(`- [ ] ${tabs}x`, null, '2026-10-09'),
    ],
    [
      'removing a day link after a run of tabs and a word',
      () => removeDayLink(`- [ ] ${tabs}x [[2026-10-09]]`, '2026-10-09'),
    ],
    [
      'removing a day link before a run of tabs and a word',
      () => removeDayLink(`- [ ] [[2026-10-09]]${tabs}x`, '2026-10-09'),
    ],
  ])('take a time in proportion to their length: %s', (_, read) => {
    const start = performance.now();
    read();

    expect(performance.now() - start).toBeLessThan(500);
  });
});

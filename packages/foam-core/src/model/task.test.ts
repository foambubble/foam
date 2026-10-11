import { createNoteFromMarkdown } from '../../test/test-utils';
import { TextEdit } from '../services/text-edit';
import { parseIsoDate } from '../utils/date';
import { Range } from './range';
import { Task, TaskStatus } from './task';

const parse = (content: string) => createNoteFromMarkdown('/note.md', content);

/** The day `text`, as `YYYY-MM-DD`, at local midnight. */
const day = (text: string) => parseIsoDate(text)!;

/**
 * `content` moved from day `from` to day `to`, as `YYYY-MM-DD` or null, by the
 * edits for its first task.
 */
const schedule = (content: string, from: string | null, to: string | null) => {
  const note = parse(content);
  return TextEdit.apply(
    content,
    Task.createScheduleEdits(
      note,
      note.tasks[0],
      from === null ? null : day(from),
      to === null ? null : day(to)
    )
  );
};

describe('Task.createStatusEdits', () => {
  it('marks an open task done by replacing the space between its brackets', () => {
    const [task] = parse('# Day\n> 1. [ ] Call Anna\n').tasks;

    expect(Task.createStatusEdits(task, TaskStatus.Done)).toEqual([
      {
        range: Range.create(1, 6, 1, 7),
        newText: 'x',
      },
    ]);
  });

  it('marks a done task open, whichever case its x is', () => {
    const content = '- [x] a\n- [X] b';
    const [lower, upper] = parse(content).tasks;

    expect(
      TextEdit.apply(content, [
        ...Task.createStatusEdits(lower, TaskStatus.Open),
        ...Task.createStatusEdits(upper, TaskStatus.Open),
      ])
    ).toBe('- [ ] a\n- [ ] b');
  });

  it('makes no edit when the task already has the status', () => {
    const [open, lower, upper] = parse('- [ ] a\n- [x] b\n- [X] c').tasks;

    expect(Task.createStatusEdits(open, TaskStatus.Open)).toEqual([]);
    expect(Task.createStatusEdits(lower, TaskStatus.Done)).toEqual([]);
    expect(Task.createStatusEdits(upper, TaskStatus.Done)).toEqual([]);
  });

  it('changes only the mark, each line keeping its own ending', () => {
    const content = '- [ ] a\r\n  - [ ] b\n> - [ ] c\r\n';
    const [, nested, quoted] = parse(content).tasks;

    expect(
      TextEdit.apply(content, [
        ...Task.createStatusEdits(nested, TaskStatus.Done),
        ...Task.createStatusEdits(quoted, TaskStatus.Done),
      ])
    ).toBe('- [ ] a\r\n  - [x] b\n> - [x] c\r\n');
  });
});

describe('Task.getLinks', () => {
  it("gives the links on the task's line, of every kind, in the order written", () => {
    const note = parse(
      '- [ ] Call [[Anna]] about [the plan](plan.md), ![[photo.png]] [[2026-10-09]]\n  [[next line]]\n- [ ] Other [[Bob]]'
    );

    expect(
      note.tasks.map(task =>
        Task.getLinks(note, task).map(link => link.rawText)
      )
    ).toEqual([
      ['[[Anna]]', '[the plan](plan.md)', '![[photo.png]]', '[[2026-10-09]]'],
      ['[[Bob]]'],
    ]);
  });
});

describe('Task.getDays', () => {
  it('gives the days a task links, with a folder, a section or an alias, each once', () => {
    const note = parse(
      '- [ ] a [[2026-10-08]] b [[journal/2026-10-09]] c [[2026-10-10#Log]] d [[2026-10-11|Sunday]] [[2026-10-08]]'
    );

    expect(Task.getDays(note, note.tasks[0])).toEqual([
      day('2026-10-08'),
      day('2026-10-09'),
      day('2026-10-10'),
      day('2026-10-11'),
    ]);
  });

  it('ignores embeds, inline code, other notes and dates that do not exist', () => {
    const note = parse(
      '- [ ] ![[2026-10-08]] `[[2026-10-09]]` [[zettelkasten]] [[2026-02-30]] [[2026-13-01]] [[2026-10-08 notes]] [[x2026-10-08]]'
    );

    expect(Task.getDays(note, note.tasks[0])).toEqual([]);
  });

  it("reads only the links on the task's own line", () => {
    const note = parse(
      '- [ ] a [[2026-10-08]]\n  [[2026-10-09]]\n- [ ] b [[2026-10-10]]'
    );

    expect(note.tasks.map(task => Task.getDays(note, task))).toEqual([
      [day('2026-10-08')],
      [day('2026-10-10')],
    ]);
  });

  it('does not take a link that runs over an unclosed [[ for a day', () => {
    const note = parse('- [ ] [[2026-10-09# [[2026-10-09]]');

    expect(Task.getDays(note, note.tasks[0])).toEqual([]);
  });
});

describe('Task.createScheduleEdits', () => {
  it('appends a link to the day when the task links no day it was shown under', () => {
    expect(schedule('- [ ] Send review notes', null, '2026-10-09')).toBe(
      '- [ ] Send review notes [[2026-10-09]]'
    );
    expect(schedule('- [ ] In a daily note', '2026-10-07', '2026-10-08')).toBe(
      '- [ ] In a daily note [[2026-10-08]]'
    );
  });

  it('appends before trailing whitespace, which stays where it was', () => {
    expect(schedule('- [ ] Hard break  ', null, '2026-10-09')).toBe(
      '- [ ] Hard break [[2026-10-09]]  '
    );
  });

  it('appends to numbered and quoted tasks, each line keeping its own ending', () => {
    const content = '1. [ ] Send notes  \r\n> - [ ] Call Anna\n';
    const note = parse(content);
    const [numbered, quoted] = note.tasks;

    expect(
      TextEdit.apply(content, [
        ...Task.createScheduleEdits(note, numbered, null, day('2026-10-09')),
        ...Task.createScheduleEdits(note, quoted, null, day('2026-10-12')),
      ])
    ).toBe(
      '1. [ ] Send notes [[2026-10-09]]  \r\n> - [ ] Call Anna [[2026-10-12]]\n'
    );
  });

  it('moves the link to the day the task was shown under', () => {
    expect(
      schedule(
        '- [ ] Send review notes [[2026-10-07]] to the team',
        '2026-10-07',
        '2026-10-08'
      )
    ).toBe('- [ ] Send review notes [[2026-10-08]] to the team');
  });

  it('keeps the folder, section and alias of the link, and the other day links', () => {
    expect(
      schedule(
        '- [ ] Book [[journal/2026-10-07#Log|2026-10-07]] [[2026-10-12]]',
        '2026-10-07',
        '2026-10-08'
      )
    ).toBe('- [ ] Book [[journal/2026-10-08#Log|2026-10-08]] [[2026-10-12]]');
  });

  it('leaves an alias that is more than the day as written', () => {
    expect(
      schedule(
        '- [ ] Call [[2026-10-07|notes from 2026-10-07 meeting]]',
        '2026-10-07',
        '2026-10-08'
      )
    ).toBe('- [ ] Call [[2026-10-08|notes from 2026-10-07 meeting]]');
  });

  it('removes the shown day instead when the task already links the new one', () => {
    expect(
      schedule(
        '- [ ] Book [[2026-10-07]] [[2026-10-12]]',
        '2026-10-07',
        '2026-10-12'
      )
    ).toBe('- [ ] Book [[2026-10-12]]');
  });

  it('changes nothing when the task is already on the day', () => {
    const note = parse('- [ ] Book [[2026-10-07]]\n- [ ] Mine');
    const [linked, undated] = note.tasks;

    expect(
      Task.createScheduleEdits(
        note,
        linked,
        day('2026-10-07'),
        day('2026-10-07')
      )
    ).toEqual([]);
    expect(
      Task.createScheduleEdits(note, linked, null, day('2026-10-07'))
    ).toEqual([]);
    expect(
      Task.createScheduleEdits(
        note,
        undated,
        day('2026-10-07'),
        day('2026-10-07')
      )
    ).toEqual([]);
    expect(Task.createScheduleEdits(note, undated, null, null)).toEqual([]);
  });

  it('compares days by date, whatever their time of day', () => {
    const content = '- [ ] Call [[2026-10-07]]';
    const note = parse(content);

    expect(
      TextEdit.apply(
        content,
        Task.createScheduleEdits(
          note,
          note.tasks[0],
          new Date(2026, 9, 7, 18, 30),
          new Date(2026, 9, 8, 23, 59)
        )
      )
    ).toBe('- [ ] Call [[2026-10-08]]');
  });

  it('round-trips a rescheduled task back to its first day', () => {
    const content = '- [ ] Call [[2026-10-07]] about it';
    const moved = schedule(content, '2026-10-07', '2026-10-09');

    expect(schedule(moved, '2026-10-09', '2026-10-07')).toBe(content);
  });
});

describe('Task.createScheduleEdits with no day to move to', () => {
  it.each([
    '- [ ] Send review notes',
    '- [ ] Hard break  ',
    '- [ ] Tab\t',
    '  * [x] Nested [[zettelkasten]] done',
    '- [ ] Already [[2026-10-12]] linked',
    '- [ ] Unicode — ünïcode 🧠',
    '1. [ ] Send notes  \r\n',
  ])('gives back %j as it was before scheduling', content => {
    const scheduled = schedule(content, null, '2026-10-09');

    expect(scheduled).not.toBe(content);
    expect(schedule(scheduled, '2026-10-09', null)).toBe(content);
  });

  it('removes a link in the middle with the space after it', () => {
    expect(
      schedule('- [ ] Call [[2026-10-07]] about it', '2026-10-07', null)
    ).toBe('- [ ] Call about it');
  });

  it('removes a link right after the checkbox with the space after it', () => {
    expect(schedule('- [ ] [[2026-10-07]] Call', '2026-10-07', null)).toBe(
      '- [ ] Call'
    );
  });

  it('removes every link to that day and leaves the others', () => {
    expect(
      schedule(
        '- [ ] a [[2026-10-07]] b [[2026-10-08]] [[journal/2026-10-07]]',
        '2026-10-07',
        null
      )
    ).toBe('- [ ] a b [[2026-10-08]]');
  });

  it('changes nothing when the task links no such day', () => {
    const note = parse('- [ ] a [[2026-10-08]]');

    expect(
      Task.createScheduleEdits(note, note.tasks[0], day('2026-10-07'), null)
    ).toEqual([]);
  });

  it('changes nothing when the links to the day are all the text there is', () => {
    for (const content of [
      '- [ ] [[2026-10-07]]',
      '- [ ] [[2026-10-07]]  ',
      '- [ ] [[2026-10-07]] [[journal/2026-10-07]]',
    ]) {
      const note = parse(content);

      expect([
        content,
        Task.createScheduleEdits(note, note.tasks[0], day('2026-10-07'), null),
      ]).toEqual([content, []]);
    }
  });

  it('removes a day already moved to while other text is left', () => {
    expect(
      schedule(
        '- [ ] [[2026-10-07]] [[2026-10-12]]',
        '2026-10-07',
        '2026-10-12'
      )
    ).toBe('- [ ] [[2026-10-12]]');
  });
});

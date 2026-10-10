import { createNoteFromMarkdown } from '../../test/test-utils';
import { TextEdit } from '../services/text-edit';
import { Range } from './range';
import { Task, TaskStatus } from './task';

const parse = (content: string) => createNoteFromMarkdown('/note.md', content);

/** `content` scheduled from `from` to `to`, by the edits for its first task. */
const schedule = (content: string, from: string | null, to: string) => {
  const note = parse(content);
  return TextEdit.apply(
    content,
    Task.createScheduleEdits(note, note.tasks[0], from, to)
  );
};

/** `content` without its first task's links to `day`. */
const removeDay = (content: string, day: string) => {
  const note = parse(content);
  return TextEdit.apply(
    content,
    Task.createRemoveDayEdits(note, note.tasks[0], day)
  );
};

describe('Task.createStatusEdit', () => {
  it('marks an open task done by replacing the space between its brackets', () => {
    const [task] = parse('# Day\n> 1. [ ] Call Anna\n').tasks;

    expect(Task.createStatusEdit(task, TaskStatus.Done)).toEqual({
      range: Range.create(1, 6, 1, 7),
      newText: 'x',
    });
  });

  it('marks a done task open, whichever case its x is', () => {
    const [lower, upper] = parse('- [x] a\n- [X] b').tasks;

    expect(Task.createStatusEdit(lower, TaskStatus.Open).newText).toBe(' ');
    expect(Task.createStatusEdit(upper, TaskStatus.Open).newText).toBe(' ');
  });

  it('changes only the mark, each line keeping its own ending', () => {
    const content = '- [ ] a\r\n  - [ ] b\n> - [ ] c\r\n';
    const [, nested, quoted] = parse(content).tasks;

    expect(
      TextEdit.apply(content, [
        Task.createStatusEdit(nested, TaskStatus.Done),
        Task.createStatusEdit(quoted, TaskStatus.Done),
      ])
    ).toBe('- [ ] a\r\n  - [x] b\n> - [x] c\r\n');
  });
});

describe('Task.getDays', () => {
  it('gives the days a task links, with a folder, a section or an alias, each once', () => {
    const note = parse(
      '- [ ] a [[2026-10-08]] b [[journal/2026-10-09]] c [[2026-10-10#Log]] d [[2026-10-11|Sunday]] [[2026-10-08]]'
    );

    expect(Task.getDays(note, note.tasks[0])).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
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
      ['2026-10-08'],
      ['2026-10-10'],
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
        ...Task.createScheduleEdits(note, numbered, null, '2026-10-09'),
        ...Task.createScheduleEdits(note, quoted, null, '2026-10-12'),
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
      Task.createScheduleEdits(note, linked, '2026-10-07', '2026-10-07')
    ).toEqual([]);
    expect(Task.createScheduleEdits(note, linked, null, '2026-10-07')).toEqual(
      []
    );
    expect(
      Task.createScheduleEdits(note, undated, '2026-10-07', '2026-10-07')
    ).toEqual([]);
  });

  it('round-trips a rescheduled task back to its first day', () => {
    const content = '- [ ] Call [[2026-10-07]] about it';
    const moved = schedule(content, '2026-10-07', '2026-10-09');

    expect(schedule(moved, '2026-10-09', '2026-10-07')).toBe(content);
  });
});

describe('Task.createRemoveDayEdits', () => {
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
    expect(removeDay(scheduled, '2026-10-09')).toBe(content);
  });

  it('removes a link in the middle with the space after it', () => {
    expect(removeDay('- [ ] Call [[2026-10-07]] about it', '2026-10-07')).toBe(
      '- [ ] Call about it'
    );
  });

  it('removes a link right after the checkbox with the space after it', () => {
    expect(removeDay('- [ ] [[2026-10-07]] Call', '2026-10-07')).toBe(
      '- [ ] Call'
    );
  });

  it('removes every link to that day and leaves the others', () => {
    expect(
      removeDay(
        '- [ ] a [[2026-10-07]] b [[2026-10-08]] [[journal/2026-10-07]]',
        '2026-10-07'
      )
    ).toBe('- [ ] a b [[2026-10-08]]');
  });

  it('changes nothing when the task links no such day', () => {
    const note = parse('- [ ] a [[2026-10-08]]');

    expect(
      Task.createRemoveDayEdits(note, note.tasks[0], '2026-10-07')
    ).toEqual([]);
  });
});

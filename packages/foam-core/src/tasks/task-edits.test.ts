import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import {
  editShownLine,
  removeTaskDay,
  scheduleTask,
  shownLineIn,
  toggleTask,
} from './task-edits';
import { taskLinesOf } from './task-lines';

describe('toggleTask', () => {
  it('ticks an open task by replacing the space between its brackets', () => {
    const [task] = taskLinesOf('# Day\n> 1. [ ] Call Anna\n');

    expect(toggleTask(task)).toEqual({
      range: Range.create(1, 6, 1, 7),
      newText: 'x',
    });
  });

  it('unticks a done task, whichever case its x is', () => {
    const [lower, upper] = taskLinesOf('- [x] a\n- [X] b');

    expect(toggleTask(lower).newText).toBe(' ');
    expect(toggleTask(upper).newText).toBe(' ');
  });

  it('changes only the mark, each line keeping its own ending', () => {
    const content = '- [ ] a\r\n  - [ ] b\n> - [ ] c\r\n';
    const [, nested, quoted] = taskLinesOf(content);

    const once = TextEdit.apply(content, toggleTask(nested));
    const twice = TextEdit.apply(once, toggleTask(quoted));

    expect(twice).toBe('- [ ] a\r\n  - [x] b\n> - [x] c\r\n');
  });
});

describe('scheduleTask', () => {
  it('appends a link to the day after the text of a numbered or quoted task', () => {
    const content = '1. [ ] Send notes  \r\n> - [ ] Call Anna\n';
    const [numbered, quoted] = taskLinesOf(content);

    const once = TextEdit.apply(
      content,
      scheduleTask(numbered, null, '2026-10-09')!
    );
    const twice = TextEdit.apply(
      once,
      scheduleTask(quoted, null, '2026-10-12')!
    );

    expect(twice).toBe(
      '1. [ ] Send notes [[2026-10-09]]  \r\n> - [ ] Call Anna [[2026-10-12]]\n'
    );
  });

  it('changes only the day link when moving the task to another day', () => {
    const content = '> - [ ] Call [[2026-10-07|Wed]] now';
    const [task] = taskLinesOf(content);

    const edit = scheduleTask(task, '2026-10-07', '2026-10-09')!;

    expect(edit.range.start.character).toBeGreaterThanOrEqual(
      task.checkbox.end.character
    );
    expect(TextEdit.apply(content, edit)).toBe(
      '> - [ ] Call [[2026-10-09|Wed]] now'
    );
  });

  it('is null when the task is already on that day', () => {
    const [task] = taskLinesOf('- [ ] a [[2026-10-09]]');

    expect(scheduleTask(task, '2026-10-09', '2026-10-09')).toBeNull();
  });
});

describe('removeTaskDay', () => {
  it('removes the link to the day, giving back the line as it was', () => {
    const content = '1. [ ] Send notes [[2026-10-09]]  \r\n';
    const [task] = taskLinesOf(content);

    expect(TextEdit.apply(content, removeTaskDay(task, '2026-10-09')!)).toBe(
      '1. [ ] Send notes  \r\n'
    );
  });

  it('is null when the task links no such day', () => {
    const [task] = taskLinesOf('- [ ] a [[2026-10-09]]');

    expect(removeTaskDay(task, '2026-10-10')).toBeNull();
  });
});

describe('shownLineIn', () => {
  const lines = ['# Day\r', '- [ ] a\r', '- [ ] b'];

  it('is the line itself while it still reads as shown', () => {
    expect(shownLineIn(lines, 1, '- [ ] a')).toBe(1);
  });

  it('is the one other line that reads as shown, after lines moved it', () => {
    expect(shownLineIn(['x', ...lines], 1, '- [ ] a')).toBe(2);
  });

  it('is null when no line, or several, read as shown', () => {
    expect(shownLineIn(lines, 1, '- [ ] c')).toBeNull();
    expect(shownLineIn([...lines, '- [ ] b'], 0, '- [ ] b')).toBeNull();
  });
});

describe('editShownLine', () => {
  it('applies an edit to the line it was made for while it reads as shown', () => {
    const content = '# Day\n- [ ] a\r\n';
    const [task] = taskLinesOf(content);

    expect(editShownLine(content, task.raw, toggleTask(task))).toBe(
      '# Day\n- [x] a\r\n'
    );
  });

  it('applies it where the line is now, after lines were written above it', () => {
    const shown = '# Day\n> 1. [ ] a\n';
    const [task] = taskLinesOf(shown);

    expect(
      editShownLine(
        '# Day\n- 09:00 x\n> 1. [ ] a\n',
        task.raw,
        toggleTask(task)
      )
    ).toBe('# Day\n- 09:00 x\n> 1. [x] a\n');
  });

  it('is null when the line no longer reads as shown', () => {
    const [task] = taskLinesOf('- [ ] a\n');

    expect(
      editShownLine('- [ ] a, edited\n', task.raw, toggleTask(task))
    ).toBeNull();
  });
});

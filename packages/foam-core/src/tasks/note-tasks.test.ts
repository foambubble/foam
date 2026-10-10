import { URI } from '../model/uri';
import { taskDays, tasksOf } from './note-tasks';

const uri = URI.file('/workspace/journal/2026-10-07.md');

describe('tasksOf', () => {
  it("gives a note's task lines with the note and its day", () => {
    const tasks = tasksOf(
      uri,
      '- [ ] a\n- [x] b [[2026-10-09]]\n',
      () => '2026-10-07'
    );

    expect(tasks.map(t => [t.line, t.uri.path, t.noteDay, t.days])).toEqual([
      [0, uri.path, '2026-10-07', []],
      [1, uri.path, '2026-10-07', ['2026-10-09']],
    ]);
  });

  it('asks for the day only of a note with tasks', () => {
    const dayOf = vi.fn(() => null);

    expect(tasksOf(uri, '# No tasks\n', dayOf)).toEqual([]);
    expect(dayOf).not.toHaveBeenCalled();
  });
});

describe('taskDays', () => {
  it('is the days a task links, or else the day of its daily note', () => {
    const [linked, undated] = tasksOf(
      uri,
      '- [ ] a [[2026-10-09]] [[2026-10-12]]\n- [ ] b\n',
      () => '2026-10-07'
    );

    expect(taskDays(linked)).toEqual(['2026-10-09', '2026-10-12']);
    expect(taskDays(undated)).toEqual(['2026-10-07']);
    expect(taskDays({ ...undated, noteDay: null })).toEqual([]);
  });
});

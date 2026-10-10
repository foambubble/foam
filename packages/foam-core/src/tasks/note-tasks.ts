import { URI } from '../model/uri';
import { TaskLine, taskLinesOf } from './task-lines';

/** A task line, with the note it is in. */
export interface Task extends TaskLine {
  uri: URI;
  /** The day of the daily note it is in; null outside daily notes. */
  noteDay: string | null;
}

/**
 * The tasks of the note at `uri`, whose text is `content`. `dayOf` gives a
 * note's day when it is a daily note, null otherwise; it is asked only for a
 * note with tasks.
 */
export function tasksOf(
  uri: URI,
  content: string,
  dayOf: (uri: URI) => string | null
): Task[] {
  const lines = taskLinesOf(content);
  const noteDay = lines.length > 0 ? dayOf(uri) : null;
  return lines.map(line => ({ ...line, uri, noteDay }));
}

/**
 * The days a task is on: the days it links, or, when it links none and sits
 * in a daily note, that note's day.
 */
export function taskDays(task: Task): string[] {
  if (task.days.length > 0) {
    return task.days;
  }
  return task.noteDay === null ? [] : [task.noteDay];
}

import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import { removeDayLink, scheduleLine } from './day-links';
import { TaskLine } from './task-lines';

/** The edit that ticks `task`, or unticks it when done: its checkbox's mark. */
export function toggleTask(task: TaskLine): TextEdit {
  const { line, character } = task.checkbox.start;
  return {
    range: Range.create(line, character + 1, line, character + 2),
    newText: task.done ? ' ' : 'x',
  };
}

/**
 * The edit that schedules `task` for `to`, having been shown under `from`
 * (null when it was shown under no day): see `scheduleLine`. Null when the
 * line stays as it is.
 */
export function scheduleTask(
  task: TaskLine,
  from: string | null,
  to: string
): TextEdit | null {
  return lineEdit(task, scheduleLine(task.raw, from, to));
}

/**
 * The edit that removes `task`'s links to `day`: see `removeDayLink`. Null
 * when it links no such day.
 */
export function removeTaskDay(task: TaskLine, day: string): TextEdit | null {
  return lineEdit(task, removeDayLink(task.raw, day));
}

/** The edit that turns `task`'s line into `raw`: what differs, and only that. */
function lineEdit(task: TaskLine, raw: string): TextEdit | null {
  const before = task.raw;
  if (raw === before) {
    return null;
  }
  let start = 0;
  while (start < before.length && before[start] === raw[start]) {
    start++;
  }
  let end = 0;
  while (
    end < before.length - start &&
    end < raw.length - start &&
    before[before.length - 1 - end] === raw[raw.length - 1 - end]
  ) {
    end++;
  }
  return {
    range: Range.create(task.line, start, task.line, before.length - end),
    newText: raw.slice(start, raw.length - end),
  };
}

/**
 * Where the line shown as `shown` (without its `\r`) at `line` of `lines` is
 * now: `line` while it still reads `shown`, else the one other line that does
 * (lines written above it move it). Null with none, or several.
 */
export function shownLineIn(
  lines: string[],
  line: number,
  shown: string
): number | null {
  const reads = (n: number) => lines[n].replace(/\r$/, '') === shown;
  if (lines[line] !== undefined && reads(line)) {
    return line;
  }
  const found = lines.flatMap((_, n) => (reads(n) ? [n] : []));
  return found.length === 1 ? found[0] : null;
}

/**
 * `content` with `edit`, made for the line that read `shown` (without its
 * `\r`) at `edit`'s line, applied to that line where it is now (see
 * {@link shownLineIn}). Null when no line, or several, read `shown`, or the
 * edit changes nothing: the note changed since it was shown.
 */
export function editShownLine(
  content: string,
  shown: string,
  edit: TextEdit
): string | null {
  const { start, end } = edit.range;
  const at = shownLineIn(content.split('\n'), start.line, shown);
  if (
    at === null ||
    shown.slice(start.character, end.character) === edit.newText
  ) {
    return null;
  }
  return TextEdit.apply(content, {
    range: Range.create(at, start.character, at, end.character),
    newText: edit.newText,
  });
}

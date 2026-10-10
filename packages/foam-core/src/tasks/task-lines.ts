import { Range } from '../model/range';
import { dayLinksIn } from './day-links';
import { ListItem, listItemsOf } from './markdown-blocks';

/**
 * A task line of a note: a GFM list item, at any depth and in block quotes
 * too, whose checkbox (`[ ]`, `[x]` or `[X]`, then a space or a tab) has text
 * after it on the same line.
 */
export interface TaskLine {
  /** Its line in the note, from 0. */
  line: number;
  /** The line as written, without its `\r`. */
  raw: string;
  done: boolean;
  /** Where its checkbox is on the line, brackets included. */
  checkbox: Range;
  /** The text after the checkbox and the space or tab that follows it. */
  text: string;
  /** The days it links, as `YYYY-MM-DD`, each once, in the order written. */
  days: string[];
}

/** A checkbox written anywhere; notes without one hold no task. */
const ANY_CHECKBOX = /\[[ \txX]\][ \t]/;

/**
 * The task lines of `content`, in line order, as core's parser reads its
 * list items. One per line: of items nested on the same line, the first.
 */
export function taskLinesOf(content: string): TaskLine[] {
  if (!ANY_CHECKBOX.test(content)) {
    return [];
  }
  const lines = content.split('\n').map(line => line.replace(/\r$/, ''));
  const tasks: TaskLine[] = [];
  for (const item of listItemsOf(lines)) {
    const raw = lines[item.line];
    const text = raw.slice(item.col + 4);
    if (
      item.checked === null ||
      !/[^ \t]/.test(text) ||
      tasks[tasks.length - 1]?.line === item.line
    ) {
      continue;
    }
    tasks.push({
      line: item.line,
      raw,
      done: item.checked,
      checkbox: Range.create(item.line, item.col, item.line, item.col + 3),
      text,
      days: [...new Set(dayLinksIn(text).map(link => link.day))],
    });
  }
  return tasks.sort((a, b) => a.line - b.line);
}

/**
 * The list item opening on `line` of `content`, as core's parser reads it,
 * with or without a checkbox or text; null when none opens there. Of items
 * nested on the same line, the first.
 */
export function listItemAt(content: string, line: number): ListItem | null {
  const lines = content.split('\n').map(row => row.replace(/\r$/, ''));
  return listItemsOf(lines).find(item => item.line === line) ?? null;
}

import { MarkdownLink } from '../services/markdown-link';
import { TextEdit } from '../services/text-edit';
import type { Resource, ResourceLink } from './note';
import { Range } from './range';

/** Where a task stands, as its checkbox says. */
export enum TaskStatus {
  Open = 'open',
  Done = 'done',
}

/**
 * A GFM task: a list item whose checkbox has text after it on the same line,
 * as core's parser reads it.
 */
export interface Task {
  /** From its checkbox to the end of the checkbox's line. */
  range: Range;
  status: TaskStatus;
  /** What follows the checkbox and the space or tab after it, on that line. */
  text: string;
}

/** The mark between the brackets of a checkbox for each status. */
const MARKS: Record<TaskStatus, string> = {
  [TaskStatus.Open]: ' ',
  [TaskStatus.Done]: 'x',
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export abstract class Task {
  /** The edit that gives `task` the `status`: the mark in its checkbox. */
  static createStatusEdit(task: Task, status: TaskStatus): TextEdit {
    const { line, character } = task.range.start;
    return {
      range: Range.create(line, character + 1, line, character + 2),
      newText: MARKS[status],
    };
  }

  /**
   * The days `task` links, as `YYYY-MM-DD`, each once, in the order written:
   * its wikilinks, not embeds, whose target's last segment is a date that
   * exists. `resource` is the note the task is in.
   */
  static getDays(resource: Resource, task: Task): string[] {
    return [...new Set(dayLinks(resource, task).map(({ day }) => day))];
  }

  /**
   * The edits that schedule `task` for `to`, having been shown under `from`
   * (null when it was shown under no day). Its links to `from` move to `to`;
   * when it links no `from`, a `[[to]]` link is appended after its text. A
   * task that already links `to` loses its links to `from` instead. None when
   * the task stays as it is.
   */
  static createScheduleEdits(
    resource: Resource,
    task: Task,
    from: string | null,
    to: string
  ): TextEdit[] {
    if (from === to) {
      return [];
    }
    const links = dayLinks(resource, task);
    if (links.some(({ day }) => day === to)) {
      return from === null
        ? []
        : Task.createRemoveDayEdits(resource, task, from);
    }
    const linksFrom = links.filter(({ day }) => day === from);
    if (linksFrom.length === 0) {
      const { line } = task.range.start;
      const end =
        task.range.end.character - task.text.length + trailingStart(task.text);
      return [{ range: Range.create(line, end), newText: ` [[${to}]]` }];
    }
    return linksFrom.map(({ link }) => {
      const { target, alias } = MarkdownLink.analyzeLink(link);
      return MarkdownLink.createUpdateLinkEdit(link, {
        target: target.slice(0, target.length - from.length) + to,
        alias: alias.split(from).join(to),
      });
    });
  }

  /**
   * The edit that removes `task`'s links to `day`; none when it links no such
   * day. A link that ends the text goes with the whitespace before it, any
   * other with the space after it, so that removing what
   * {@link Task.createScheduleEdits} appended gives back the task as it was.
   */
  static createRemoveDayEdits(
    resource: Resource,
    task: Task,
    day: string
  ): TextEdit[] {
    const links = dayLinks(resource, task).filter(link => link.day === day);
    if (links.length === 0) {
      return [];
    }
    const textStart = task.range.end.character - task.text.length;
    const before = task.text;
    let after = before;
    for (const { link } of links.reverse()) {
      after = withoutRange(
        after,
        link.range.start.character - textStart,
        link.range.end.character - textStart
      );
    }
    // Only what differs is replaced.
    let start = 0;
    while (start < after.length && before[start] === after[start]) {
      start++;
    }
    let end = 0;
    while (
      end < after.length - start &&
      before[before.length - 1 - end] === after[after.length - 1 - end]
    ) {
      end++;
    }
    const { line } = task.range.start;
    return [
      {
        range: Range.create(
          line,
          textStart + start,
          line,
          textStart + before.length - end
        ),
        newText: after.slice(start, after.length - end),
      },
    ];
  }
}

/**
 * The wikilinks of `task` to a day, in the order written. A link the parser
 * reads over an unclosed `[[` is none: removing it would remove that text too.
 */
function dayLinks(
  resource: Resource,
  task: Task
): { link: ResourceLink; day: string }[] {
  return resource.links.flatMap(link => {
    if (
      link.type !== 'wikilink' ||
      link.isEmbed ||
      link.rawText.indexOf('[[', 2) !== -1 ||
      !Range.containsRange(task.range, link.range)
    ) {
      return [];
    }
    const { target } = MarkdownLink.analyzeLink(link);
    const day = target.slice(target.lastIndexOf('/') + 1);
    return isDay(day) ? [{ link, day }] : [];
  });
}

/** Whether `text` is a date that exists, as `YYYY-MM-DD`. */
function isDay(text: string): boolean {
  const parts = DAY.exec(text);
  if (!parts) {
    return false;
  }
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Where the spaces and tabs that `text` ends with start. */
function trailingStart(text: string): number {
  let start = text.length;
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) {
    start--;
  }
  return start;
}

/**
 * `text` without what is between `start` and `end`: with the whitespace
 * before it when only whitespace follows, else with the space after it.
 */
function withoutRange(text: string, start: number, end: number): string {
  const after = text.slice(end);
  if (trailingStart(after) === 0) {
    const before = text.slice(0, start);
    return before.slice(0, trailingStart(before)) + after;
  }
  return text.slice(0, start) + after.replace(/^ /, '');
}

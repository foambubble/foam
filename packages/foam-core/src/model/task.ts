import { MarkdownLink } from '../services/markdown-link';
import { TextEdit } from '../services/text-edit';
import { formatIsoDate, parseIsoDate } from '../utils/date';
import type { Resource, ResourceLink } from './note';
import { Position } from './position';
import { Range } from './range';

/** Where a task stands, as its checkbox says. */
export enum TaskStatus {
  Open = 'open',
  Done = 'done',
}

/**
 * A GFM task: a list item whose checkbox has text after it on the same line,
 * as core's parser reads it. The item's first paragraph is the task's text,
 * on as many lines as it takes; nested items are tasks of their own.
 */
export interface Task {
  /** From its checkbox to the end of its text. */
  range: Range;
  status: TaskStatus;
  /**
   * What follows the checkbox and the space or tab after it, as written:
   * line breaks are `\n`, and later lines keep what starts them, such as
   * indentation or a block quote's `>`.
   */
  text: string;
}

/** The mark between the brackets of a checkbox for each status. */
const MARKS: Record<TaskStatus, string> = {
  [TaskStatus.Open]: ' ',
  [TaskStatus.Done]: 'x',
};

export abstract class Task {
  /**
   * The edit that gives `task` the `status`: the mark in its checkbox. None
   * when it already has it, whatever case its `x` is.
   */
  static createStatusEdits(task: Task, status: TaskStatus): TextEdit[] {
    if (task.status === status) {
      return [];
    }
    const { line, character } = task.range.start;
    return [
      {
        range: Range.create(line, character + 1, line, character + 2),
        newText: MARKS[status],
      },
    ];
  }

  /**
   * The links in `task`'s text, on every line it takes, of every kind, in the
   * order written. `resource` is the note the task is in.
   */
  static getLinks(resource: Resource, task: Task): ResourceLink[] {
    return resource.links.filter(link =>
      Range.containsRange(task.range, link.range)
    );
  }

  /**
   * The days of {@link Task.getDayLinks}, each once, in the order written.
   * `resource` is the note the task is in.
   */
  static getDays(resource: Resource, task: Task): Date[] {
    const days = Task.getDayLinks(resource, task).map(({ day }) => day);
    return [...new Map(days.map(day => [day.getTime(), day])).values()];
  }

  /**
   * The links `task` has to a day, in the order written, each with its day
   * at local midnight: wikilinks, not embeds, whose target's last segment is
   * a date that exists, as `YYYY-MM-DD`. A link the parser reads over an
   * unclosed `[[` is none: removing it would remove that text too.
   * `resource` is the note the task is in.
   */
  static getDayLinks(
    resource: Resource,
    task: Task
  ): { link: ResourceLink; day: Date }[] {
    return Task.getLinks(resource, task).flatMap(link => {
      if (
        link.type !== 'wikilink' ||
        link.isEmbed ||
        link.rawText.indexOf('[[', 2) !== -1
      ) {
        return [];
      }
      const { target } = MarkdownLink.analyzeLink(link);
      const day = parseIsoDate(target.slice(target.lastIndexOf('/') + 1));
      return day === undefined ? [] : [{ link, day }];
    });
  }

  /**
   * The edits that move `task` from day `from` to day `to`, either null for
   * no day; days compare by date, in local time. Its links to `from` move to
   * `to`, an alias that is the day itself with them; when it links no `from`,
   * a `[[to]]` link is appended after its text, as `YYYY-MM-DD`. When it
   * already links `to`, or `to` is null, its links to `from` go instead: one
   * that ends its line with the spaces before it, and with its line when
   * nothing else is left on it, any other with the space after it, so that
   * taking off a day just added gives back the task as it was. None when the
   * task stays as it is, or when removing would leave it no text and so no
   * task. `resource` is the note the task is in.
   */
  static createScheduleEdits(
    resource: Resource,
    task: Task,
    from: Date | null,
    to: Date | null
  ): TextEdit[] {
    const fromDay = from === null ? null : formatIsoDate(from);
    const toDay = to === null ? null : formatIsoDate(to);
    if (fromDay === toDay) {
      return [];
    }
    const links = Task.getDayLinks(resource, task).map(({ link, day }) => ({
      link,
      day: formatIsoDate(day),
    }));
    const linksFrom = links.filter(({ day }) => day === fromDay);
    if (toDay === null || links.some(({ day }) => day === toDay)) {
      return removeLinks(
        task,
        linksFrom.map(({ link }) => link)
      );
    }
    if (linksFrom.length === 0) {
      const end = positionIn(task, trailingStart(task.text));
      return [
        { range: Range.createFromPosition(end), newText: ` [[${toDay}]]` },
      ];
    }
    return linksFrom.map(({ link }) => {
      const { target, alias } = MarkdownLink.analyzeLink(link);
      return MarkdownLink.createUpdateLinkEdit(link, {
        target: target.slice(0, target.length - fromDay.length) + toDay,
        alias: alias === fromDay ? toDay : alias,
      });
    });
  }
}

/**
 * The edit that removes `links` from `task`'s text, each by the rule of
 * {@link Task.createScheduleEdits}; none without links, or when the task
 * would be left with no text.
 */
function removeLinks(task: Task, links: ResourceLink[]): TextEdit[] {
  if (links.length === 0) {
    return [];
  }
  const before = task.text;
  let after = before;
  for (const link of [...links].reverse()) {
    after = withoutRange(
      after,
      offsetIn(task, link.range.start),
      offsetIn(task, link.range.end)
    );
  }
  // A checkbox with nothing after it is no longer a task
  if (!/[^ \t\n]/.test(after)) {
    return [];
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
  return [
    {
      range: Range.createFromPosition(
        positionIn(task, start),
        positionIn(task, before.length - end)
      ),
      newText: after.slice(start, after.length - end),
    },
  ];
}

/** Where `task`'s text starts: after its checkbox and the space or tab. */
function textStart(task: Task): Position {
  return Position.create(task.range.start.line, task.range.start.character + 4);
}

/** The offset in `task`'s text of `position`, a position within it. */
function offsetIn(task: Task, position: Position): number {
  const lines = task.text.split('\n');
  const first = textStart(task);
  let offset = 0;
  for (let line = first.line; line < position.line; line++) {
    offset += lines[line - first.line].length + 1;
  }
  return (
    offset +
    position.character -
    (position.line === first.line ? first.character : 0)
  );
}

/** The position in the note of `offset` in `task`'s text. */
function positionIn(task: Task, offset: number): Position {
  const lines = task.text.split('\n');
  const first = textStart(task);
  let line = 0;
  while (line < lines.length - 1 && offset > lines[line].length) {
    offset -= lines[line].length + 1;
    line++;
  }
  return Position.create(
    first.line + line,
    (line === 0 ? first.character : 0) + offset
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
 * `text` without what is between `start` and `end`. What ends its line goes
 * with the spaces and tabs before it, and with its line when nothing else is
 * left on it; anything else goes with the space after it.
 */
function withoutRange(text: string, start: number, end: number): string {
  const after = text.slice(end);
  const lineBreak = after.indexOf('\n');
  const restOfLine = lineBreak === -1 ? after : after.slice(0, lineBreak);
  if (trailingStart(restOfLine) !== 0) {
    return text.slice(0, start) + after.replace(/^ /, '');
  }
  const before = text.slice(0, start);
  const kept = before.slice(0, trailingStart(before));
  return kept.endsWith('\n')
    ? kept.slice(0, -1) + after.slice(restOfLine.length)
    : kept + after;
}

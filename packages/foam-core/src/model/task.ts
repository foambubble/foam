import { MarkdownLink } from '../services/markdown-link';
import { TextEdit } from '../services/text-edit';
import { formatIsoDate, parseIsoDate } from '../utils/date';
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
   * The links on `task`'s line, of every kind, in the order written.
   * `resource` is the note the task is in.
   */
  static getLinks(resource: Resource, task: Task): ResourceLink[] {
    return resource.links.filter(link =>
      Range.containsRange(task.range, link.range)
    );
  }

  /**
   * The days `task` links, at local midnight, each once, in the order
   * written: its wikilinks, not embeds, whose target's last segment is a date
   * that exists, as `YYYY-MM-DD`. `resource` is the note the task is in.
   */
  static getDays(resource: Resource, task: Task): Date[] {
    const days = new Set(dayLinks(resource, task).map(({ day }) => day));
    return [...days].map(day => parseIsoDate(day)!);
  }

  /**
   * The edits that move `task` from day `from` to day `to`, either null for
   * no day; days compare by date, in local time. Its links to `from` move to
   * `to`; when it links no `from`, a `[[to]]` link is appended after its
   * text, as `YYYY-MM-DD`. When it already links `to`, or `to` is null, its
   * links to `from` go instead: one that ends the text with the whitespace
   * before it, any other with the space after it, so that taking off a day
   * just added gives back the task as it was. None when the task stays as it
   * is. `resource` is the note the task is in.
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
    const links = dayLinks(resource, task);
    const linksFrom = links.filter(({ day }) => day === fromDay);
    if (toDay === null || links.some(({ day }) => day === toDay)) {
      return removeLinks(
        task,
        linksFrom.map(({ link }) => link)
      );
    }
    if (linksFrom.length === 0) {
      const { line } = task.range.start;
      const end =
        task.range.end.character - task.text.length + trailingStart(task.text);
      return [{ range: Range.create(line, end), newText: ` [[${toDay}]]` }];
    }
    return linksFrom.map(({ link }) => {
      const { target, alias } = MarkdownLink.analyzeLink(link);
      return MarkdownLink.createUpdateLinkEdit(link, {
        target: target.slice(0, target.length - fromDay.length) + toDay,
        alias: alias.split(fromDay).join(toDay),
      });
    });
  }
}

/**
 * The edit that removes `links` from `task`'s line, each by the rule of
 * {@link Task.createScheduleEdits}; none without links.
 */
function removeLinks(task: Task, links: ResourceLink[]): TextEdit[] {
  if (links.length === 0) {
    return [];
  }
  const textStart = task.range.end.character - task.text.length;
  const before = task.text;
  let after = before;
  for (const link of [...links].reverse()) {
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

/**
 * The wikilinks of `task` to a day, in the order written. A link the parser
 * reads over an unclosed `[[` is none: removing it would remove that text too.
 */
function dayLinks(
  resource: Resource,
  task: Task
): { link: ResourceLink; day: string }[] {
  return Task.getLinks(resource, task).flatMap(link => {
    if (
      link.type !== 'wikilink' ||
      link.isEmbed ||
      link.rawText.indexOf('[[', 2) !== -1
    ) {
      return [];
    }
    const { target } = MarkdownLink.analyzeLink(link);
    const day = target.slice(target.lastIndexOf('/') + 1);
    return parseIsoDate(day) === undefined ? [] : [{ link, day }];
  });
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

import dayjs from 'dayjs';
import { URI, asAbsoluteUri } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { dailyNotePattern, defaultDailyNotePath } from './daily-note-location';
import { TriggerFactory } from './note-creation-triggers';
import { NoteCreationTrigger, Template } from './note-creation-types';
import { findPreviousDailyNote } from './previous-daily-note';
import { Resolver } from './variable-resolver';

/** The inputs of a note-creation flow that creates a daily note. */
export interface DailyNoteCreation {
  trigger: NoteCreationTrigger;
  /**
   * The daily-note template, or, when there is none, a note holding only a
   * heading with the date as `YYYY-MM-DD`.
   */
  template: Template;
  /**
   * Resolves `FOAM_TITLE` to the date as `YYYY-MM-DD`, `FOAM_DATE_*` to the
   * date, and `FOAM_PREVIOUS_DAILY_NOTE` to the identifier of the latest
   * daily note before it, among the notes that follow the daily-note pattern.
   */
  resolver: Resolver;
  /** Where the note goes when the template does not set a `filepath`. */
  fallbackFilepath: URI;
}

/**
 * How to create the daily note for `date`. Running the template is left to
 * the note-creation flow, so this needs no JavaScript sandbox: a JavaScript
 * template comes in already loaded.
 *
 * @param template the daily-note template, or `undefined` when there is none
 * @param workspace where previous daily notes are looked up, and whose roots
 * the fallback filepath resolves against
 * @param locale for the locale-sensitive `FOAM_DATE_*` variables
 */
export function prepareDailyNote(
  date: Date,
  template: Template | undefined,
  workspace: FoamWorkspace,
  locale = 'default'
): DailyNoteCreation {
  const title = dayjs(date).format('YYYY-MM-DD');
  const pattern = dailyNotePattern(template);
  const resolver = new Resolver(
    new Map([['FOAM_TITLE', title]]),
    date,
    undefined,
    locale,
    undefined,
    before => {
      const uri = findPreviousDailyNote(workspace, pattern, before);
      return uri && workspace.getIdentifier(uri);
    }
  );
  return {
    trigger: TriggerFactory.createCommandTrigger('foam.open-daily-note'),
    template: template ?? {
      type: 'markdown',
      metadata: new Map(),
      content: `# ${title}\n`,
    },
    resolver,
    fallbackFilepath: asAbsoluteUri(
      defaultDailyNotePath(date),
      workspace.roots
    ),
  };
}

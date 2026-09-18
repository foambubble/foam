import { Resource } from '../model/note';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { PatternPart, dailyNotePathMatcher } from './daily-note-path-pattern';

/**
 * Returns the most recent daily note strictly before `before`, or `undefined`
 * when there is none — or when `pattern` cannot name a day, which is how a
 * workspace whose daily note path is not invertible reports the feature as
 * unavailable.
 *
 * The workspace is scanned once and the search is bounded by the daily notes
 * that exist, not by a number of days walked backwards, so a note years older
 * than the one being created is still found.
 */
export function findPreviousDailyNote(
  workspace: FoamWorkspace,
  pattern: PatternPart[] | undefined,
  before: Date
): URI | undefined {
  const match = pattern && dailyNotePathMatcher(pattern);
  if (!match) {
    return undefined;
  }

  // `before` carries a wall-clock time, so the comparison is by day: a note
  // for the same date is not a previous note.
  const cutoff = new Date(
    before.getFullYear(),
    before.getMonth(),
    before.getDate()
  ).getTime();

  let found: { time: number; uri: URI } | undefined;
  // Sorted so that two notes claiming the same date resolve deterministically
  for (const resource of workspace.list().sort(Resource.sortByPath)) {
    const date = match(workspace.relativePath(resource.uri));
    if (!date) {
      continue;
    }
    const time = date.getTime();
    if (time >= cutoff) {
      continue;
    }
    if (!found || time > found.time) {
      found = { time, uri: resource.uri };
    }
  }
  return found?.uri;
}

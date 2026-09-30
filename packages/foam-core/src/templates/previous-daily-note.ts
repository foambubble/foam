import { Resource } from '../model/note';
import { URI, findRootByName } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { isPathWithin } from '../utils/path';
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
  const target = pattern && namedRoot(pattern, workspace.roots);
  const match = pattern && dailyNotePathMatcher(target?.pattern ?? pattern);
  if (!match) {
    return undefined;
  }
  // A single root the path names can also hold daily notes inside a folder of
  // that name: the deprecated `openDailyNote.directory` writes them there (its
  // writer matches root names only in a multi-root workspace), and so did
  // templates before root names were matched. Both forms count.
  const matchUnnamed =
    target && workspace.roots.length === 1
      ? dailyNotePathMatcher(pattern)
      : undefined;

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
    if (target && !isPathWithin(resource.uri.path, target.root.path)) {
      continue;
    }
    const path = workspace.relativePath(resource.uri);
    const date = match(path) ?? matchUnnamed?.(path);
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

/**
 * The root a path pattern names, and the pattern read from inside it.
 * Daily notes are written where `FoamWorkspace.resolveNoteUri` puts the
 * template path, so `/notes/journal/...` names the `notes` root and only its
 * notes count, matched against `/journal/...`.
 */
function namedRoot(
  pattern: PatternPart[],
  roots: URI[]
): { root: URI; pattern: PatternPart[] } | undefined {
  const [first, ...rest] = pattern;
  if (first?.kind !== 'literal') {
    return undefined;
  }
  const name = /^\/([^/]+)\//.exec(first.text)?.[1];
  const root = name === undefined ? undefined : findRootByName(name, roots);
  return (
    root && {
      root,
      pattern: [
        { kind: 'literal', text: first.text.slice(name.length + 1) },
        ...rest,
      ],
    }
  );
}

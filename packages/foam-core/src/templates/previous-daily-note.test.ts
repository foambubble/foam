import { URI } from '../model/uri';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { partsFromTemplateFilepath } from './daily-note-path-pattern';
import { dailyNotePattern } from './daily-note-location';
import {
  dailyNoteDateMatcher,
  findPreviousDailyNote,
} from './previous-daily-note';

const pattern = partsFromTemplateFilepath(
  '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
);

const workspaceWith = (paths: string[]) => {
  const workspace = createTestWorkspace([URI.file('/workspace')]);
  paths.forEach(uri => workspace.set(createTestNote({ uri })));
  return workspace;
};

describe('findPreviousDailyNote', () => {
  // 2026-09-11 is a Friday, 2026-09-14 a Monday, 2026-09-16 a Wednesday
  it('skips the gap and finds the most recent daily note that exists (AC-1)', () => {
    const workspace = workspaceWith([
      '/workspace/journal/2026-09-11.md',
      '/workspace/journal/2026-09-14.md',
    ]);

    const previous = findPreviousDailyNote(
      workspace,
      pattern,
      new Date(2026, 8, 16)
    );

    expect(previous.path).toEqual('/workspace/journal/2026-09-14.md');
  });

  it('searches back from the target date, not from the latest note (AC-4)', () => {
    const workspace = workspaceWith([
      '/workspace/journal/2026-09-11.md',
      '/workspace/journal/2026-09-14.md',
      '/workspace/journal/2026-09-20.md',
    ]);

    const previous = findPreviousDailyNote(
      workspace,
      pattern,
      new Date(2026, 8, 15)
    );

    expect(previous.path).toEqual('/workspace/journal/2026-09-14.md');
  });

  it('does not count the target date itself as a previous note', () => {
    const workspace = workspaceWith([
      '/workspace/journal/2026-09-14.md',
      '/workspace/journal/2026-09-16.md',
    ]);

    // the target date carries a wall-clock time, the note dates do not
    const previous = findPreviousDailyNote(
      workspace,
      pattern,
      new Date(2026, 8, 16, 14, 30)
    );

    expect(previous.path).toEqual('/workspace/journal/2026-09-14.md');
  });

  it('finds a daily note years older than the one being created (AC-7)', () => {
    const workspace = workspaceWith(['/workspace/journal/2019-03-04.md']);

    const previous = findPreviousDailyNote(
      workspace,
      pattern,
      new Date(2026, 8, 16)
    );

    expect(previous.path).toEqual('/workspace/journal/2019-03-04.md');
  });

  it('returns the workspace identifier Foam uses for wikilinks (AC-5)', () => {
    const workspace = workspaceWith(['/workspace/journal/2026-09-14.md']);

    const previous = findPreviousDailyNote(
      workspace,
      pattern,
      new Date(2026, 8, 16)
    );

    expect(workspace.getIdentifier(previous)).toEqual('2026-09-14');
  });

  it('returns undefined when the workspace has no earlier daily note', () => {
    const workspace = workspaceWith(['/workspace/journal/2026-09-20.md']);

    expect(
      findPreviousDailyNote(workspace, pattern, new Date(2026, 8, 16))
    ).toBeUndefined();
  });

  it('ignores notes that do not match the daily note path', () => {
    const workspace = workspaceWith([
      '/workspace/journal/2026-09-15-standup.md',
      '/workspace/journal/retrospective.md',
      '/workspace/notes/2026-09-15.md',
    ]);

    expect(
      findPreviousDailyNote(workspace, pattern, new Date(2026, 8, 16))
    ).toBeUndefined();
  });

  it('finds daily notes in the root that a leading-slash path names, in a multi-root workspace (#1711)', () => {
    const workspace = createTestWorkspace([
      URI.file('/work/my-project'),
      URI.file('/home/me/notes'),
    ]);
    workspace.set(
      createTestNote({ uri: '/home/me/notes/journal/2026-09-14.md' })
    );
    const inNotesRoot = partsFromTemplateFilepath(
      '/notes/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );

    const previous = findPreviousDailyNote(
      workspace,
      inNotesRoot,
      new Date(2026, 8, 16)
    );

    expect(previous?.path).toEqual('/home/me/notes/journal/2026-09-14.md');
  });

  it('ignores notes at the same path in a root the path does not name', () => {
    const workspace = createTestWorkspace([
      URI.file('/work/my-project'),
      URI.file('/home/me/notes'),
    ]);
    workspace.set(
      createTestNote({ uri: '/work/my-project/notes/journal/2026-09-20.md' })
    );
    workspace.set(
      createTestNote({ uri: '/home/me/notes/journal/2026-09-14.md' })
    );
    const inNotesRoot = partsFromTemplateFilepath(
      '/notes/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );

    const previous = findPreviousDailyNote(
      workspace,
      inNotesRoot,
      new Date(2026, 8, 22)
    );

    expect(previous?.path).toEqual('/home/me/notes/journal/2026-09-14.md');
  });

  it('finds daily notes in a root the path names when that root is opened on its own', () => {
    const workspace = createTestWorkspace([URI.file('/home/me/notes')]);
    workspace.set(
      createTestNote({ uri: '/home/me/notes/journal/2026-09-14.md' })
    );
    const inNotesRoot = partsFromTemplateFilepath(
      '/notes/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );

    const previous = findPreviousDailyNote(
      workspace,
      inNotesRoot,
      new Date(2026, 8, 16)
    );

    expect(previous?.path).toEqual('/home/me/notes/journal/2026-09-14.md');
  });

  it('still finds daily notes inside a folder named like the single root, as daily notes without a template filepath are written', () => {
    const workspace = createTestWorkspace([URI.file('/home/me/journal')]);
    workspace.set(
      createTestNote({ uri: '/home/me/journal/journal/2026-09-14.md' })
    );
    const previous = findPreviousDailyNote(
      workspace,
      dailyNotePattern(undefined),
      new Date(2026, 8, 16)
    );

    expect(previous?.path).toEqual('/home/me/journal/journal/2026-09-14.md');
  });

  it('returns undefined when the daily note path cannot name a day', () => {
    const workspace = workspaceWith(['/workspace/journal/2026-09-14.md']);
    const monthNamePattern = partsFromTemplateFilepath(
      '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH_NAME}-${FOAM_DATE_DATE}.md'
    );

    expect(
      findPreviousDailyNote(workspace, monthNamePattern, new Date(2026, 8, 16))
    ).toBeUndefined();
  });
});

describe('dailyNoteDateMatcher', () => {
  const inNotesRoot = partsFromTemplateFilepath(
    '/notes/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
  );

  it('gives the day of a daily note, and nothing for any other note', () => {
    const workspace = workspaceWith([]);

    const dateOf = dailyNoteDateMatcher(workspace, pattern);

    expect(dateOf(URI.file('/workspace/journal/2026-09-14.md'))).toEqual(
      new Date(2026, 8, 14)
    );
    expect(
      dateOf(URI.file('/workspace/journal/2026-09-15-standup.md'))
    ).toBeUndefined();
    expect(dateOf(URI.file('/workspace/notes/2026-09-14.md'))).toBeUndefined();
  });

  it('reads back a note whose path pattern names the root it is in', () => {
    const workspace = createTestWorkspace([URI.file('/home/me/notes')]);

    const dateOf = dailyNoteDateMatcher(workspace, inNotesRoot);

    expect(dateOf(URI.file('/home/me/notes/journal/2026-10-07.md'))).toEqual(
      new Date(2026, 9, 7)
    );
  });

  it('reads back a note at the pattern as written, when the single root is named like its first folder', () => {
    const workspace = createTestWorkspace([URI.file('/home/me/journal')]);

    const dateOf = dailyNoteDateMatcher(workspace, dailyNotePattern(undefined));

    expect(dateOf(URI.file('/home/me/journal/journal/2026-09-14.md'))).toEqual(
      new Date(2026, 8, 14)
    );
  });

  it('counts only the root the path names, in a multi-root workspace', () => {
    const workspace = createTestWorkspace([
      URI.file('/work/my-project'),
      URI.file('/home/me/notes'),
    ]);

    const dateOf = dailyNoteDateMatcher(workspace, inNotesRoot);

    expect(dateOf(URI.file('/home/me/notes/journal/2026-09-14.md'))).toEqual(
      new Date(2026, 8, 14)
    );
    expect(
      dateOf(URI.file('/work/my-project/notes/journal/2026-09-20.md'))
    ).toBeUndefined();
  });

  it('is unavailable when the daily note path cannot name a day', () => {
    const workspace = workspaceWith([]);
    const monthNamePattern = partsFromTemplateFilepath(
      '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH_NAME}-${FOAM_DATE_DATE}.md'
    );

    expect(dailyNoteDateMatcher(workspace, monthNamePattern)).toBeUndefined();
    expect(dailyNoteDateMatcher(workspace, undefined)).toBeUndefined();
  });
});

import { URI } from '../model/uri';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { partsFromTemplateFilepath } from './daily-note-path-pattern';
import { findPreviousDailyNote } from './previous-daily-note';

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

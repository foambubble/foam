import {
  dailyNotePathMatcher,
  partsFromDailyNoteSettings,
  partsFromTemplateFilepath,
} from './daily-note-path-pattern';

const DEFAULT_TEMPLATE_PATH =
  '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md';

const matcherForTemplate = (filepath: string) => {
  const parts = partsFromTemplateFilepath(filepath);
  return parts && dailyNotePathMatcher(parts);
};

describe('inverting a daily note template filepath', () => {
  it('reads the date back out of the default daily note path', () => {
    const match = matcherForTemplate(DEFAULT_TEMPLATE_PATH);
    expect(match('/journal/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
  });

  it('treats FOAM_TITLE as the formatted date, as the daily note flows set it', () => {
    const match = matcherForTemplate('/journal/$FOAM_TITLE.md');
    expect(match('/journal/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
  });

  it('handles a path nested by year and month', () => {
    const match = matcherForTemplate(
      '/journal/${FOAM_DATE_YEAR}/${FOAM_DATE_MONTH}/${FOAM_DATE_DATE}.md'
    );
    expect(match('/journal/2026/09/18.md')).toEqual(new Date(2026, 8, 18));
  });

  it('handles a FOAM_DATE_FORMAT path', () => {
    const match = matcherForTemplate(
      '/journal/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(match('/journal/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
  });

  it('reads a two-digit year as the current century, like dayjs writes it', () => {
    const match = matcherForTemplate(
      '/journal/${FOAM_DATE_YEAR_SHORT}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );
    expect(match('/journal/26-09-18.md')).toEqual(new Date(2026, 8, 18));
  });

  it('keeps a directory whose name contains format letters literal', () => {
    const match = matcherForTemplate(
      '/Documents/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );
    expect(match('/Documents/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
    expect(match('/2026-09-18.md')).toBeUndefined();
  });

  it('matches a relative pattern on a path suffix, since its prefix is not knowable', () => {
    const match = matcherForTemplate(
      'journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );
    expect(match('/journal/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
    expect(match('/projects/journal/2026-09-18.md')).toEqual(
      new Date(2026, 8, 18)
    );
  });

  it('does not match a note that merely sits in the daily note folder', () => {
    const match = matcherForTemplate(DEFAULT_TEMPLATE_PATH);
    expect(match('/journal/meeting-notes.md')).toBeUndefined();
    expect(match('/journal/2026-09-18-standup.md')).toBeUndefined();
    expect(match('/notes/2026-09-18.md')).toBeUndefined();
  });

  it('rejects a date the calendar does not have', () => {
    const match = matcherForTemplate(DEFAULT_TEMPLATE_PATH);
    expect(match('/journal/2026-02-31.md')).toBeUndefined();
  });

  it('is unavailable for a path built from a month name', () => {
    expect(
      partsFromTemplateFilepath(
        '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH_NAME}-${FOAM_DATE_DATE}.md'
      )
    ).toBeUndefined();
  });

  it('is unavailable for a path built from a variable that is not a date', () => {
    expect(
      partsFromTemplateFilepath(
        '$FOAM_CURRENT_DIR/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
      )
    ).toBeUndefined();
  });

  it('is unavailable for a path that names a month but not a day', () => {
    const parts = partsFromTemplateFilepath(
      '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}.md'
    );
    expect(dailyNotePathMatcher(parts)).toBeUndefined();
  });
});

describe('inverting the deprecated openDailyNote settings', () => {
  it('reads the date back out of a directory and filename format', () => {
    const match = dailyNotePathMatcher(
      partsFromDailyNoteSettings('journal', 'isoDate', 'md')
    );
    expect(match('/journal/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
    expect(match('/other/2026-09-18.md')).toBeUndefined();
  });

  it('anchors a "." directory at the workspace root', () => {
    const match = dailyNotePathMatcher(
      partsFromDailyNoteSettings('.', 'yyyy-mm-dd', 'md')
    );
    expect(match('/2026-09-18.md')).toEqual(new Date(2026, 8, 18));
    expect(match('/journal/2026-09-18.md')).toBeUndefined();
  });

  it('respects the configured file extension', () => {
    const match = dailyNotePathMatcher(
      partsFromDailyNoteSettings('journal', 'yyyy-mm-dd', 'txt')
    );
    expect(match('/journal/2026-09-18.txt')).toEqual(new Date(2026, 8, 18));
    expect(match('/journal/2026-09-18.md')).toBeUndefined();
  });

  it('is unavailable for a filename format built from a week number', () => {
    expect(
      partsFromDailyNoteSettings('journal', 'yyyy-WW', 'md')
    ).toBeUndefined();
  });
});

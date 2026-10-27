import { DefaultFoamConfig, LegacyDailyNoteSettings } from '../config';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { dailyNotePathMatcher } from './daily-note-path-pattern';
import {
  DEFAULT_DAILY_NOTE_TEMPLATE,
  dailyNoteName,
  dailyNotePattern,
  dailyNoteRule,
  defaultDailyNotePath,
  ignoredDailyNoteSettings,
  legacyDailyNoteFilepath,
  legacyDailyNoteTemplate,
} from './daily-note-location';
import { Template } from './note-creation-types';
import { Resolver } from './variable-resolver';

const OCT_7 = new Date(2026, 9, 7);

const ALL_LEGACY_SETTINGS: LegacyDailyNoteSettings = {
  directory: 'diary',
  filenameFormat: 'dd-mm-yyyy',
  fileExtension: 'markdown',
  titleFormat: 'fullDate',
};

const markdownTemplate = (content: string): Template => {
  const [metadata] = extractFoamTemplateFrontmatterMetadata(content);
  return { type: 'markdown', content, metadata };
};

const javascriptTemplate: Template = {
  type: 'javascript',
  createNote: async () => ({ filepath: 'anywhere.md', content: '' }),
};

const matches = (template: Template | undefined, path: string) => {
  const parts = dailyNotePattern(template);
  return parts && dailyNotePathMatcher(parts)?.(path);
};

describe('where the daily note lives', () => {
  it('follows the filepath of a markdown template that has one', () => {
    const template = markdownTemplate(DEFAULT_DAILY_NOTE_TEMPLATE);

    expect(dailyNoteRule(template)).toBe('template');
    expect(matches(template, '/journal/2026-10-07.md')).toEqual(OCT_7);
  });

  it('defaults to journal/YYYY-MM-DD.md when the template has no filepath', () => {
    const template = markdownTemplate('# $FOAM_TITLE\n');

    expect(dailyNoteRule(template)).toBe('default');
    expect(defaultDailyNotePath(OCT_7)).toBe('journal/2026-10-07.md');
    expect(matches(template, '/journal/2026-10-07.md')).toEqual(OCT_7);
  });

  it('defaults to journal/YYYY-MM-DD.md when there is no template', () => {
    expect(dailyNoteRule(undefined)).toBe('default');
    expect(matches(undefined, '/journal/2026-10-07.md')).toEqual(OCT_7);
    expect(matches(undefined, '/diary/2026-10-07.md')).toBeUndefined();
  });

  it('has no location for a JavaScript template, which computes its path as it runs', () => {
    expect(dailyNoteRule(javascriptTemplate)).toBe('unavailable');
    expect(dailyNotePattern(javascriptTemplate)).toBeUndefined();
  });
});

describe('the name a daily note gets', () => {
  it('is the date as YYYY-MM-DD when there is no template', async () => {
    expect(await dailyNoteName(OCT_7, undefined)).toBe('2026-10-07');
  });

  it('is the date as YYYY-MM-DD when the template has no filepath', async () => {
    expect(await dailyNoteName(OCT_7, markdownTemplate('# Day\n'))).toBe(
      '2026-10-07'
    );
  });

  it("is the file name the template's filepath gives it, without the extension", async () => {
    const template = markdownTemplate(
      '---\nfoam_template:\n  filepath: "/diary/${FOAM_DATE_FORMAT:DD-MM-YYYY}.markdown"\n---\n'
    );

    expect(await dailyNoteName(OCT_7, template)).toBe('07-10-2026');
  });

  it('resolves locale-sensitive variables in the filepath in the given locale', async () => {
    const template = markdownTemplate(
      '---\nfoam_template:\n  filepath: "/diary/${FOAM_DATE_DATE}-${FOAM_DATE_MONTH_NAME}.md"\n---\n'
    );

    expect(await dailyNoteName(OCT_7, template, 'it-IT')).toBe('07-ottobre');
  });

  it('is the date as YYYY-MM-DD for a JavaScript template, which picks its filepath as it runs', async () => {
    expect(await dailyNoteName(OCT_7, javascriptTemplate)).toBe('2026-10-07');
  });
});

describe('the openDailyNote settings Foam no longer uses', () => {
  it('names none when none are set', () => {
    expect(
      ignoredDailyNoteSettings(
        undefined,
        new DefaultFoamConfig().getLegacyDailyNoteSettings()
      )
    ).toEqual([]);
  });

  it('names every setting that is set when there is no template', () => {
    expect(ignoredDailyNoteSettings(undefined, ALL_LEGACY_SETTINGS)).toEqual([
      'foam.openDailyNote.directory',
      'foam.openDailyNote.filenameFormat',
      'foam.openDailyNote.fileExtension',
      'foam.openDailyNote.titleFormat',
    ]);
  });

  it('names only the settings that placed the note when the template sets no filepath, since the template gives the content', () => {
    expect(
      ignoredDailyNoteSettings(markdownTemplate('# Day\n'), ALL_LEGACY_SETTINGS)
    ).toEqual([
      'foam.openDailyNote.directory',
      'foam.openDailyNote.filenameFormat',
      'foam.openDailyNote.fileExtension',
    ]);
    expect(
      ignoredDailyNoteSettings(markdownTemplate('# Day\n'), {
        titleFormat: 'fullDate',
      })
    ).toEqual([]);
  });

  it("names none when the template's filepath places daily notes", () => {
    expect(
      ignoredDailyNoteSettings(
        markdownTemplate(DEFAULT_DAILY_NOTE_TEMPLATE),
        ALL_LEGACY_SETTINGS
      )
    ).toEqual([]);
  });

  it('names none for a JavaScript template, which returns its own filepath', () => {
    expect(
      ignoredDailyNoteSettings(javascriptTemplate, ALL_LEGACY_SETTINGS)
    ).toEqual([]);
  });
});

describe('a template that keeps daily notes where the openDailyNote settings put them', () => {
  it('builds the filepath from the directory, the filename format and the extension', () => {
    expect(legacyDailyNoteFilepath(ALL_LEGACY_SETTINGS)).toBe(
      '/diary/${FOAM_DATE_FORMAT:DD-MM-YYYY}.markdown'
    );
  });

  it('uses the old defaults for the settings that are not set', () => {
    expect(legacyDailyNoteFilepath({ directory: 'diary' })).toBe(
      '/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(legacyDailyNoteFilepath({ fileExtension: 'txt' })).toBe(
      '/journal/${FOAM_DATE_FORMAT:YYYY-MM-DD}.txt'
    );
  });

  it('puts daily notes at the workspace root when the directory is "."', () => {
    expect(legacyDailyNoteFilepath({ directory: '.' })).toBe(
      '/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(legacyDailyNoteFilepath({ directory: './' })).toBe(
      '/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
  });

  it('normalizes the directory the way the settings resolved it', () => {
    expect(legacyDailyNoteFilepath({ directory: 'notes/../diary/' })).toBe(
      '/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(legacyDailyNoteFilepath({ directory: 'notes\\diary' })).toBe(
      '/notes/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
  });

  it('keeps an absolute directory as it is', () => {
    expect(legacyDailyNoteFilepath({ directory: '/home/me/diary' })).toBe(
      '/home/me/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(legacyDailyNoteFilepath({ directory: 'C:\\notes\\diary' })).toBe(
      'C:/notes/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
  });

  it('keeps a directory whose name looks like template syntax', async () => {
    const filepath = legacyDailyNoteFilepath({ directory: 'cost $1 {x}' });

    expect(await new Resolver(new Map(), OCT_7).resolveText(filepath)).toBe(
      '/cost $1 {x}/2026-10-07.md'
    );
  });

  it('is a template whose filepath is the one built from the settings', () => {
    const [metadata] = extractFoamTemplateFrontmatterMetadata(
      legacyDailyNoteTemplate(ALL_LEGACY_SETTINGS)
    );

    expect(metadata.get('filepath')).toBe(
      legacyDailyNoteFilepath(ALL_LEGACY_SETTINGS)
    );
  });

  it('keeps the previous daily note findable where the settings put daily notes', () => {
    const template = markdownTemplate(
      legacyDailyNoteTemplate(ALL_LEGACY_SETTINGS)
    );

    expect(matches(template, '/diary/07-10-2026.markdown')).toEqual(OCT_7);
  });
});

describe('the default daily-note template', () => {
  it('places daily notes in the default directory', () => {
    const [metadata] = extractFoamTemplateFrontmatterMetadata(
      DEFAULT_DAILY_NOTE_TEMPLATE
    );

    expect(metadata.get('filepath')).toBe(
      '/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md'
    );
  });
});

import { DefaultFoamConfig, LegacyDailyNoteSettings } from '../config';
import { URI } from '../model/uri';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { dailyNotePathMatcher } from './daily-note-path-pattern';
import {
  DEFAULT_DAILY_NOTE_TEMPLATE,
  dailyNoteName,
  dailyNotePattern,
  dailyNoteRule,
  defaultDailyNotePath,
  ignoredDailyNoteSettings,
  ignoredDailyNoteSettingsNotice,
  legacyDailyNoteFilepath,
  legacyDailyNoteFrontmatter,
  legacyDailyNoteTemplate,
} from './daily-note-location';
import { Template } from './note-creation-types';
import { Resolver } from './variable-resolver';

const OCT_7 = new Date(2026, 9, 7);
const ROOTS = [URI.file('/workspace')];

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
        new DefaultFoamConfig().getLegacyDailyNoteSettings(),
        ROOTS
      )
    ).toEqual([]);
  });

  it('names every setting that is set when there is no template', () => {
    expect(
      ignoredDailyNoteSettings(undefined, ALL_LEGACY_SETTINGS, ROOTS)
    ).toEqual([
      'foam.openDailyNote.directory',
      'foam.openDailyNote.filenameFormat',
      'foam.openDailyNote.fileExtension',
      'foam.openDailyNote.titleFormat',
    ]);
  });

  it('names none that spells out what Foam does without them', () => {
    for (const settings of [
      {
        directory: 'journal',
        filenameFormat: 'isoDate',
        fileExtension: 'md',
        titleFormat: 'yyyy-mm-dd',
      },
      { directory: './journal/', filenameFormat: 'yyyy-mm-dd' },
      { directory: '/workspace/journal' },
    ]) {
      expect(ignoredDailyNoteSettings(undefined, settings, ROOTS)).toEqual([]);
    }
  });

  it('names only the settings that differ from what Foam does without them', () => {
    expect(
      ignoredDailyNoteSettings(
        undefined,
        { directory: 'journal', fileExtension: 'txt', titleFormat: 'isoDate' },
        ROOTS
      )
    ).toEqual(['foam.openDailyNote.fileExtension']);
  });

  it('names only the settings that placed the note when the template sets no filepath, since the template gives the content', () => {
    expect(
      ignoredDailyNoteSettings(
        markdownTemplate('# Day\n'),
        ALL_LEGACY_SETTINGS,
        ROOTS
      )
    ).toEqual([
      'foam.openDailyNote.directory',
      'foam.openDailyNote.filenameFormat',
      'foam.openDailyNote.fileExtension',
    ]);
    expect(
      ignoredDailyNoteSettings(
        markdownTemplate('# Day\n'),
        { titleFormat: 'fullDate' },
        ROOTS
      )
    ).toEqual([]);
  });

  it("names none when the template's filepath places daily notes", () => {
    expect(
      ignoredDailyNoteSettings(
        markdownTemplate(DEFAULT_DAILY_NOTE_TEMPLATE),
        ALL_LEGACY_SETTINGS,
        ROOTS
      )
    ).toEqual([]);
  });

  it('names none for a JavaScript template, which returns its own filepath', () => {
    expect(
      ignoredDailyNoteSettings(javascriptTemplate, ALL_LEGACY_SETTINGS, ROOTS)
    ).toEqual([]);
  });
});

describe('what Foam says about the openDailyNote settings it ignores', () => {
  it('says nothing when ignoring them changes nothing', () => {
    expect(
      ignoredDailyNoteSettingsNotice(undefined, { directory: 'journal' }, ROOTS)
    ).toBeUndefined();
  });

  it('offers the template that keeps them when the workspace has none', () => {
    const settings = { directory: 'diary', titleFormat: 'fullDate' };
    const template = legacyDailyNoteTemplate(settings, ROOTS);

    expect(ignoredDailyNoteSettingsNotice(undefined, settings, ROOTS)).toEqual({
      settings: [
        'foam.openDailyNote.directory',
        'foam.openDailyNote.titleFormat',
      ],
      message:
        'foam.openDailyNote.directory and foam.openDailyNote.titleFormat are no longer used.',
      detail: `Saved as daily-note.md in the templates folder, this daily note template keeps creating daily notes as before:\n\n${template}\nOr remove these settings to create daily notes in journal/ as YYYY-MM-DD.md.`,
      fix: { kind: 'create-template', template },
    });
  });

  it('shows the filepath to add when the template has none', () => {
    const settings = { fileExtension: 'txt' };

    expect(
      ignoredDailyNoteSettingsNotice(
        markdownTemplate('# Day\n'),
        settings,
        ROOTS
      )
    ).toEqual({
      settings: ['foam.openDailyNote.fileExtension'],
      message: 'foam.openDailyNote.fileExtension is no longer used.',
      detail: `To keep daily notes where they were, add this to the daily note template's frontmatter:\n\n${legacyDailyNoteFrontmatter(
        settings,
        ROOTS
      )}\n\nOr remove this setting to create daily notes in journal/ as YYYY-MM-DD.md.`,
      fix: { kind: 'add-filepath' },
    });
  });

  it('offers nothing when the settings put daily notes outside the workspace', () => {
    expect(
      ignoredDailyNoteSettingsNotice(
        undefined,
        { directory: '/home/me/diary' },
        ROOTS
      )
    ).toEqual({
      settings: ['foam.openDailyNote.directory'],
      message: 'foam.openDailyNote.directory is no longer used.',
      detail:
        "A daily note template cannot keep daily notes outside the workspace, where foam.openDailyNote.directory puts them. Move them into the workspace and set the daily note template's filepath, or remove this setting to create daily notes in journal/ as YYYY-MM-DD.md.",
      fix: { kind: 'none' },
    });
  });
});

describe('a template that keeps daily notes where the openDailyNote settings put them', () => {
  it('builds the filepath from the directory, the filename format and the extension', () => {
    expect(legacyDailyNoteFilepath(ALL_LEGACY_SETTINGS, ROOTS)).toBe(
      '/diary/${FOAM_DATE_FORMAT:DD-MM-YYYY}.markdown'
    );
  });

  it('uses the old defaults for the settings that are not set', () => {
    expect(legacyDailyNoteFilepath({ directory: 'diary' }, ROOTS)).toBe(
      '/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(legacyDailyNoteFilepath({ fileExtension: 'txt' }, ROOTS)).toBe(
      '/journal/${FOAM_DATE_FORMAT:YYYY-MM-DD}.txt'
    );
  });

  it('puts daily notes at the workspace root when the directory is "."', () => {
    expect(legacyDailyNoteFilepath({ directory: '.' }, ROOTS)).toBe(
      '/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
    expect(legacyDailyNoteFilepath({ directory: './' }, ROOTS)).toBe(
      '/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
  });

  it('normalizes the directory the way the settings resolved it', () => {
    expect(
      legacyDailyNoteFilepath({ directory: 'notes/../diary/' }, ROOTS)
    ).toBe('/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md');
    expect(legacyDailyNoteFilepath({ directory: 'notes\\diary' }, ROOTS)).toBe(
      '/notes/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md'
    );
  });

  it('writes an absolute directory inside the workspace relative to its root', () => {
    expect(
      legacyDailyNoteFilepath({ directory: '/workspace/diary' }, ROOTS)
    ).toBe('/diary/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md');
  });

  it('has none for a directory outside the workspace, which a template filepath cannot reach', () => {
    for (const directory of ['/home/me/diary', '../diary', 'D:\\diary']) {
      expect(legacyDailyNoteFilepath({ directory }, ROOTS)).toBeUndefined();
      expect(legacyDailyNoteFrontmatter({ directory }, ROOTS)).toBeUndefined();
      expect(legacyDailyNoteTemplate({ directory }, ROOTS)).toBeUndefined();
    }
  });

  it('names the root when the directory starts with the name of a root', () => {
    expect(
      legacyDailyNoteFilepath({ directory: 'journal' }, [
        URI.file('/home/me/journal'),
      ])
    ).toBe('/journal/journal/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md');
  });

  it('names the root when the settings put daily notes in a root other than the first', () => {
    expect(
      legacyDailyNoteFilepath({ directory: 'diary/daily' }, [
        URI.file('/ws/notes'),
        URI.file('/ws/diary'),
      ])
    ).toBe('/diary/daily/${FOAM_DATE_FORMAT:YYYY-MM-DD}.md');
  });

  it('keeps a directory whose name looks like template syntax', async () => {
    const filepath = legacyDailyNoteFilepath(
      { directory: 'cost $1 {x}' },
      ROOTS
    );

    expect(await new Resolver(new Map(), OCT_7).resolveText(filepath)).toBe(
      '/cost $1 {x}/2026-10-07.md'
    );
  });

  it('is a template whose filepath is the one built from the settings', () => {
    const [metadata] = extractFoamTemplateFrontmatterMetadata(
      legacyDailyNoteTemplate(ALL_LEGACY_SETTINGS, ROOTS)
    );

    expect(metadata.get('filepath')).toBe(
      legacyDailyNoteFilepath(ALL_LEGACY_SETTINGS, ROOTS)
    );
  });

  it('keeps the previous daily note findable where the settings put daily notes', () => {
    const template = markdownTemplate(
      legacyDailyNoteTemplate(ALL_LEGACY_SETTINGS, ROOTS)
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

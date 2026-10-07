import { DefaultFoamConfig, cascadeFoamConfig } from '../config';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { dailyNotePathMatcher } from './daily-note-path-pattern';
import {
  DEFAULT_DAILY_NOTE_TEMPLATE,
  DailyNoteSettings,
  dailyNotePattern,
  dailyNoteRule,
  dailyNoteSettings,
  dailyNoteSettingsPath,
} from './daily-note-location';
import { Template } from './note-creation-types';

const OCT_7 = new Date(2026, 9, 7);

const NO_SETTINGS: DailyNoteSettings = {
  directory: null,
  filenameFormat: 'isoDate',
  fileExtension: 'md',
};

const markdownTemplate = (content: string): Template => {
  const [metadata] = extractFoamTemplateFrontmatterMetadata(content);
  return { type: 'markdown', content, metadata };
};

const javascriptTemplate: Template = {
  type: 'javascript',
  createNote: async () => ({ filepath: 'anywhere.md', content: '' }),
};

const matches = (
  template: Template | undefined,
  settings: DailyNoteSettings,
  path: string
) => {
  const parts = dailyNotePattern(template, settings);
  return parts && dailyNotePathMatcher(parts)?.(path);
};

describe('where the daily note lives', () => {
  it('follows the filepath of a markdown template that has one', () => {
    const template = markdownTemplate(DEFAULT_DAILY_NOTE_TEMPLATE);

    expect(dailyNoteRule(template, NO_SETTINGS)).toBe('template');
    expect(matches(template, NO_SETTINGS, '/journal/2026-10-07.md')).toEqual(
      OCT_7
    );
  });

  it('follows the template filepath even when the settings set a directory', () => {
    const template = markdownTemplate(DEFAULT_DAILY_NOTE_TEMPLATE);
    const settings = { ...NO_SETTINGS, directory: 'diary' };

    expect(dailyNoteRule(template, settings)).toBe('template');
    expect(matches(template, settings, '/diary/2026-10-07.md')).toBeUndefined();
  });

  it('follows the openDailyNote settings when the template has no filepath', () => {
    const template = markdownTemplate('# $FOAM_TITLE\n');
    const settings = { ...NO_SETTINGS, directory: 'diary' };

    expect(dailyNoteRule(template, settings)).toBe('settings');
    expect(dailyNoteSettingsPath(OCT_7, settings)).toBe('diary/2026-10-07.md');
    expect(matches(template, settings, '/diary/2026-10-07.md')).toEqual(OCT_7);
  });

  it('follows the openDailyNote settings when there is no template', () => {
    const settings = { ...NO_SETTINGS, directory: 'diary' };

    expect(dailyNoteRule(undefined, settings)).toBe('settings');
    expect(dailyNoteSettingsPath(OCT_7, settings)).toBe('diary/2026-10-07.md');
  });

  it('defaults to journal/YYYY-MM-DD.md when neither a template nor the settings place it', () => {
    expect(dailyNoteRule(undefined, NO_SETTINGS)).toBe('default');
    expect(dailyNoteSettingsPath(OCT_7, NO_SETTINGS)).toBe(
      'journal/2026-10-07.md'
    );
    expect(matches(undefined, NO_SETTINGS, '/journal/2026-10-07.md')).toEqual(
      OCT_7
    );
  });

  it('formats the filename with the dateformat-style filenameFormat and the extension', () => {
    const settings = {
      directory: 'diary',
      filenameFormat: 'dd-mm-yyyy',
      fileExtension: 'markdown',
    };

    expect(dailyNoteSettingsPath(OCT_7, settings)).toBe(
      'diary/07-10-2026.markdown'
    );
  });

  it('formats ISO week numbers, padded (WW) or not (W)', () => {
    const sept14 = new Date(2021, 8, 14); // ISO week 37 of 2021
    const withFormat = (filenameFormat: string) =>
      dailyNoteSettingsPath(sept14, { ...NO_SETTINGS, filenameFormat });

    expect(withFormat('yyyy/yy-WW')).toBe('journal/2021/21-37.md');
    expect(withFormat('yyyy-W')).toBe('journal/2021-37.md');
  });

  it('puts daily notes at the workspace root when the directory is set to "."', () => {
    const settings = { ...NO_SETTINGS, directory: '.' };

    expect(dailyNoteRule(undefined, settings)).toBe('settings');
    expect(dailyNoteSettingsPath(OCT_7, settings)).toBe('2026-10-07.md');
  });

  it('has no location for a JavaScript template, which computes its path as it runs', () => {
    expect(dailyNoteRule(javascriptTemplate, NO_SETTINGS)).toBe('unavailable');
    expect(dailyNotePattern(javascriptTemplate, NO_SETTINGS)).toBeUndefined();
  });
});

describe('reading the daily note settings from a Foam config', () => {
  it('reads the openDailyNote settings', () => {
    const config = cascadeFoamConfig(
      [
        {
          getDailyNoteDirectory: () => 'daily',
          getDailyNoteFilenameFormat: () => 'yyyy-mm-dd',
          getDailyNoteFileExtension: () => 'markdown',
        },
      ],
      new DefaultFoamConfig()
    );

    expect(dailyNoteSettings(config)).toEqual({
      directory: 'daily',
      filenameFormat: 'yyyy-mm-dd',
      fileExtension: 'markdown',
    });
  });

  it('leaves the directory null when it is not set', () => {
    expect(dailyNoteSettings(new DefaultFoamConfig()).directory).toBeNull();
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

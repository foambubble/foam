import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { dailyNotePathMatcher } from './daily-note-path-pattern';
import {
  DEFAULT_DAILY_NOTE_TEMPLATE,
  dailyNoteName,
  dailyNotePattern,
  dailyNoteRule,
  defaultDailyNotePath,
} from './daily-note-location';
import { Template } from './note-creation-types';

const OCT_7 = new Date(2026, 9, 7);

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

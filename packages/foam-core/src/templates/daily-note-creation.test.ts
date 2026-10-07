import { URI } from '../model/uri';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { prepareDailyNote } from './daily-note-creation';
import { DailyNoteSettings } from './daily-note-location';
import { Template } from './note-creation-types';

const ROOT = URI.file('/workspace');
const OCT_7 = new Date(2026, 9, 7);

const NO_SETTINGS: DailyNoteSettings = {
  directory: null,
  filenameFormat: 'isoDate',
  fileExtension: 'md',
  titleFormat: null,
};

const markdownTemplate = (content: string): Template => {
  const [metadata] = extractFoamTemplateFrontmatterMetadata(content);
  return { type: 'markdown', content, metadata };
};

const workspaceWith = (...paths: string[]) => {
  const workspace = createTestWorkspace([ROOT]);
  for (const path of paths) {
    workspace.set(createTestNote({ uri: ROOT.joinPath(path).path }));
  }
  return workspace;
};

const previousNote = (
  template: Template | undefined,
  settings: DailyNoteSettings,
  ...paths: string[]
) =>
  prepareDailyNote(
    OCT_7,
    template,
    settings,
    workspaceWith(...paths)
  ).resolver.resolveText('${FOAM_PREVIOUS_DAILY_NOTE:none}');

describe('the template a daily note is created from', () => {
  it("is the workspace's template when it has one", () => {
    const template = markdownTemplate('# Day\n');

    const daily = prepareDailyNote(
      OCT_7,
      template,
      NO_SETTINGS,
      workspaceWith()
    );

    expect(daily.template).toBe(template);
  });

  it('is a heading titled by openDailyNote.titleFormat when there is no template', async () => {
    const daily = prepareDailyNote(
      OCT_7,
      undefined,
      { ...NO_SETTINGS, titleFormat: 'fullDate' },
      workspaceWith()
    );

    expect(daily.template.type).toBe('markdown');
    expect(
      await daily.resolver.resolveText(
        (daily.template as Template & { type: 'markdown' }).content
      )
    ).toBe('# Wednesday, October 7, 2026\n');
  });

  it('is titled by the filename format when no title format is set', async () => {
    const daily = prepareDailyNote(
      OCT_7,
      undefined,
      { ...NO_SETTINGS, filenameFormat: 'dd-mm-yyyy' },
      workspaceWith()
    );

    expect(
      await daily.resolver.resolveText(
        (daily.template as Template & { type: 'markdown' }).content
      )
    ).toBe('# 07-10-2026\n');
  });
});

describe('where a daily note goes when the template sets no filepath', () => {
  it('is journal/YYYY-MM-DD.md when the settings do not place it', () => {
    const daily = prepareDailyNote(
      OCT_7,
      undefined,
      NO_SETTINGS,
      workspaceWith()
    );

    expect(daily.fallbackFilepath).toEqual(
      ROOT.joinPath('journal', '2026-10-07.md')
    );
  });

  it('follows the openDailyNote settings', () => {
    const daily = prepareDailyNote(
      OCT_7,
      markdownTemplate('# Day\n'),
      { ...NO_SETTINGS, directory: 'diary', filenameFormat: 'dd-mm-yyyy' },
      workspaceWith()
    );

    expect(daily.fallbackFilepath).toEqual(
      ROOT.joinPath('diary', '07-10-2026.md')
    );
  });
});

describe('the variables a daily note resolves', () => {
  it('resolves FOAM_TITLE to the date', async () => {
    const daily = prepareDailyNote(
      OCT_7,
      undefined,
      NO_SETTINGS,
      workspaceWith()
    );

    expect(await daily.resolver.resolveText('${FOAM_TITLE}')).toBe(
      '2026-10-07'
    );
  });

  it('resolves the FOAM_DATE_* variables to the date, in the given locale', async () => {
    const daily = prepareDailyNote(
      OCT_7,
      undefined,
      NO_SETTINGS,
      workspaceWith(),
      'it-IT'
    );

    expect(
      await daily.resolver.resolveText(
        '${FOAM_DATE_DATE} ${FOAM_DATE_MONTH_NAME}'
      )
    ).toBe('07 ottobre');
  });
});

describe('FOAM_PREVIOUS_DAILY_NOTE', () => {
  it("finds the previous note where the template's filepath puts daily notes", async () => {
    const template = markdownTemplate(
      '---\nfoam_template:\n  filepath: "/diary/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md"\n---\n'
    );

    expect(
      await previousNote(
        template,
        NO_SETTINGS,
        'diary/2026-10-05.md',
        'journal/2026-10-06.md'
      )
    ).toBe('2026-10-05');
  });

  it('finds the previous note where the settings put daily notes when the template sets no filepath', async () => {
    expect(
      await previousNote(
        markdownTemplate('# Day\n'),
        { ...NO_SETTINGS, directory: 'diary' },
        'diary/2026-10-05.md',
        'journal/2026-10-06.md'
      )
    ).toBe('2026-10-05');
  });

  it('finds the previous note in journal/ when neither a template nor the settings place daily notes', async () => {
    expect(
      await previousNote(undefined, NO_SETTINGS, 'journal/2026-10-06.md')
    ).toBe('2026-10-06');
  });

  it('finds none for a JavaScript template, which computes its path as it runs', async () => {
    const template: Template = {
      type: 'javascript',
      createNote: async () => ({ filepath: 'anywhere.md', content: '' }),
    };

    expect(
      await previousNote(template, NO_SETTINGS, 'journal/2026-10-06.md')
    ).toBe('none');
  });
});

import { URI } from '../model/uri';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { prepareDailyNote } from './daily-note-creation';
import { Template } from './note-creation-types';

const ROOT = URI.file('/workspace');
const OCT_7 = new Date(2026, 9, 7);

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

const previousNote = (template: Template | undefined, ...paths: string[]) =>
  prepareDailyNote(
    OCT_7,
    template,
    workspaceWith(...paths)
  ).resolver.resolveText('${FOAM_PREVIOUS_DAILY_NOTE:none}');

describe('the template a daily note is created from', () => {
  it("is the workspace's template when it has one", () => {
    const template = markdownTemplate('# Day\n');

    const daily = prepareDailyNote(OCT_7, template, workspaceWith());

    expect(daily.template).toBe(template);
  });

  it('is a heading with the date as YYYY-MM-DD when there is no template', async () => {
    const daily = prepareDailyNote(OCT_7, undefined, workspaceWith());

    expect(daily.template.type).toBe('markdown');
    expect(
      await daily.resolver.resolveText(
        (daily.template as Template & { type: 'markdown' }).content
      )
    ).toBe('# 2026-10-07\n');
  });
});

describe('where a daily note goes when the template sets no filepath', () => {
  it('is journal/YYYY-MM-DD.md', () => {
    const daily = prepareDailyNote(
      OCT_7,
      markdownTemplate('# Day\n'),
      workspaceWith()
    );

    expect(daily.fallbackFilepath).toEqual(
      ROOT.joinPath('journal', '2026-10-07.md')
    );
  });
});

describe('the variables a daily note resolves', () => {
  it('resolves FOAM_TITLE to the date', async () => {
    const daily = prepareDailyNote(OCT_7, undefined, workspaceWith());

    expect(await daily.resolver.resolveText('${FOAM_TITLE}')).toBe(
      '2026-10-07'
    );
  });

  it('resolves the FOAM_DATE_* variables to the date, in the given locale', async () => {
    const daily = prepareDailyNote(OCT_7, undefined, workspaceWith(), 'it-IT');

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
        'diary/2026-10-05.md',
        'journal/2026-10-06.md'
      )
    ).toBe('2026-10-05');
  });

  it('finds the previous note in journal/ when the template sets no filepath', async () => {
    expect(
      await previousNote(
        markdownTemplate('# Day\n'),
        'diary/2026-10-05.md',
        'journal/2026-10-04.md'
      )
    ).toBe('2026-10-04');
  });

  it('finds the previous note in journal/ when there is no template', async () => {
    expect(await previousNote(undefined, 'journal/2026-10-06.md')).toBe(
      '2026-10-06'
    );
  });

  it('finds none for a JavaScript template, which computes its path as it runs', async () => {
    const template: Template = {
      type: 'javascript',
      createNote: async () => ({ filepath: 'anywhere.md', content: '' }),
    };

    expect(await previousNote(template, 'journal/2026-10-06.md')).toBe('none');
  });
});

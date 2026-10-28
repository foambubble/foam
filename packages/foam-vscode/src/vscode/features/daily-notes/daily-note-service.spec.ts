/* @unit-ready */
import { workspace, window } from 'vscode';
import {
  CREATE_DAILY_NOTE_WARNING_RESPONSE,
  OPEN_DAILY_NOTE_TEMPLATE_RESPONSE,
  createDailyNoteIfNotExists,
  getDailyNoteLinks,
  openDailyNoteFor,
} from './daily-note-service';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  deleteFile,
  getActiveTabViewType,
  makeFoamMock,
  MARKDOWN_EDITOR_VIEW_TYPE,
  showInEditor,
  withMarkdownEditorAssociation,
  withModifiedFoamConfiguration,
} from '../../../test/test-utils-vscode';
import { createTestNote } from '../../../test/test-utils';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { fileExists, readFile } from '../../services/editor';
import {
  getDailyNoteTemplateCandidateUris,
  ignoredDailyNoteSettingsNotice,
  legacyDailyNoteFrontmatter,
  legacyDailyNoteTemplate,
} from '@foam/core';
import {
  getDailyNoteTemplateUri,
  getTemplatesDir,
} from '../../../vscode/services/template-service';
import { URI } from '@foam/core';

describe('Daily note creation and template processing', () => {
  const DAILY_NOTE_TEMPLATE = ['.foam', 'templates', 'daily-note.md'];
  const roots = () => [fromVsCodeUri(workspace.workspaceFolders[0].uri)];

  beforeEach(async () => {
    // Ensure daily note templates are removed before each test
    for (const template of getDailyNoteTemplateCandidateUris(
      getTemplatesDir()
    )) {
      if (await fileExists(template)) {
        await deleteFile(template);
      }
    }
  });

  describe('Basic daily note creation', () => {
    it('Creates a new daily note when it does not exist', async () => {
      const targetDate = new Date(2021, 8, 1);
      const foam = makeFoamMock();

      const result = await createDailyNoteIfNotExists(targetDate, foam);

      expect(result.didCreateFile).toBe(true);

      const doc = await showInEditor(result.uri);
      expect(doc.editor.document.getText()).toContain('2021-09-01');
    });

    it('creates the note in the journal folder when there is no template', async () => {
      const targetDate = new Date(2021, 8, 3);
      const foam = makeFoamMock();

      const result = await createDailyNoteIfNotExists(targetDate, foam);

      expect(result.didCreateFile).toBe(true);
      expect(result.uri.path).toMatch(/\/journal\/2021-09-03\.md$/);
    });

    it('Opens existing daily note when it already exists', async () => {
      const targetDate = new Date(2021, 8, 2);
      const foam = makeFoamMock();

      // Create the file first, where the daily note for that date lives
      const root = fromVsCodeUri(workspace.workspaceFolders[0].uri);
      const uri = root.joinPath('journal', '2021-09-02.md');
      await createFile('# Existing Note\n\nContent here', [
        'journal',
        '2021-09-02.md',
      ]);

      const result = await createDailyNoteIfNotExists(targetDate, foam);

      expect(result.didCreateFile).toBe(false);
      expect(result.uri).toEqual(uri);

      const doc = await showInEditor(uri);
      expect(doc.editor.document.getText()).toContain('Existing Note');
    });
  });

  describe('Template variable resolution', () => {
    it('Resolves all FOAM_DATE_* variables correctly', async () => {
      const targetDate = new Date(2021, 8, 12); // September 12, 2021

      const template = await createFile(
        `# \${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}

Year: \${FOAM_DATE_YEAR} (short: \${FOAM_DATE_YEAR_SHORT})
Month: \${FOAM_DATE_MONTH} (name: \${FOAM_DATE_MONTH_NAME}, short: \${FOAM_DATE_MONTH_NAME_SHORT})
Date: \${FOAM_DATE_DATE}
Day: \${FOAM_DATE_DAY_NAME} (short: \${FOAM_DATE_DAY_NAME_SHORT})
Week: \${FOAM_DATE_WEEK}
Week Year: \${FOAM_DATE_WEEK_YEAR}
Unix: \${FOAM_DATE_SECONDS_UNIX}`,
        DAILY_NOTE_TEMPLATE
      );

      const foam = makeFoamMock();
      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      const content = doc.editor.document.getText();

      expect(content).toContain('# 2021-09-12');
      expect(content).toContain('Year: 2021 (short: 21)');
      expect(content).toContain('Month: 09 (name: September, short: Sep)');
      expect(content).toContain('Date: 12');
      expect(content).toContain('Day: Sunday (short: Sun)');
      expect(content).toContain('Week: 36');
      expect(content).toContain('Week Year: 2021');

      await deleteFile(template.uri);
      await deleteFile(result.uri);
    });

    it('Resolves FOAM_PREVIOUS_DAILY_NOTE to the previous daily note', async () => {
      const targetDate = new Date(2021, 8, 26);
      const root = fromVsCodeUri(workspace.workspaceFolders[0].uri);

      const template = await createFile(
        `---
foam_template:
  filepath: '/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md'
---
Previous: [[\${FOAM_PREVIOUS_DAILY_NOTE}]]`,
        DAILY_NOTE_TEMPLATE
      );

      const foam = makeFoamMock();
      foam.workspace.set(
        createTestNote({ uri: root.joinPath('journal', '2021-09-20.md').path })
      );

      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      expect(doc.editor.document.getText()).toContain(
        'Previous: [[2021-09-20]]'
      );

      await deleteFile(template.uri);
      await deleteFile(result.uri);
    });

    it('Resolves FOAM_TITLE variable for daily notes', async () => {
      const targetDate = new Date(2021, 8, 13);

      const template = await createFile(
        '# Daily Note: ${FOAM_TITLE}\n\nToday is ${FOAM_TITLE}.',
        DAILY_NOTE_TEMPLATE
      );

      const foam = makeFoamMock();
      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      const content = doc.editor.document.getText();
      expect(content).toContain('Daily Note: 2021-09-13');
      expect(content).toContain('Today is 2021-09-13.');
      await deleteFile(result.uri);
      await deleteFile(template.uri);
    });
  });

  describe('The openDailyNote settings Foam no longer uses', () => {
    const withLegacySettings = (
      settings: Record<string, string>,
      fn: () => Promise<void>
    ) =>
      Object.entries(settings).reduceRight<() => Promise<void>>(
        (inner, [key, value]) =>
          () =>
            withModifiedFoamConfiguration(`openDailyNote.${key}`, value, inner),
        fn
      )();

    const answeringWarning = async (
      answer: string | undefined,
      fn: (spy: ReturnType<typeof vi.spyOn>) => Promise<void>
    ) => {
      const spy = vi
        .spyOn(window, 'showWarningMessage')
        .mockResolvedValue(answer as any);
      try {
        await fn(spy);
      } finally {
        spy.mockRestore();
      }
    };

    it('asks before creating a note they would have placed, and creates nothing when declined', async () => {
      const targetDate = new Date(2021, 8, 14);
      const root = fromVsCodeUri(workspace.workspaceFolders[0].uri);

      await withLegacySettings({ directory: 'diary' }, () =>
        answeringWarning(undefined, async spy => {
          const result = await createDailyNoteIfNotExists(
            targetDate,
            makeFoamMock()
          );

          expect(result).toBeUndefined();
          expect(spy.mock.calls[0][0]).toBe(
            'foam.openDailyNote.directory is no longer used.'
          );
          expect(spy.mock.calls[0][1]).toMatchObject({ modal: true });
          expect(spy.mock.calls[0][2]).toBe(CREATE_DAILY_NOTE_WARNING_RESPONSE);
          expect(await getDailyNoteTemplateUri()).toBeUndefined();
          expect(
            await fileExists(root.joinPath('journal', '2021-09-14.md'))
          ).toBe(false);
          expect(
            await fileExists(root.joinPath('diary', '2021-09-14.md'))
          ).toBe(false);
        })
      );
    });

    it('creates a template that keeps them when accepted, and the note from it', async () => {
      const targetDate = new Date(2021, 8, 17);
      const settings = {
        filenameFormat: 'dd-mm-yyyy',
        titleFormat: 'fullDate',
      };

      await withLegacySettings(settings, () =>
        answeringWarning(CREATE_DAILY_NOTE_WARNING_RESPONSE, async () => {
          const result = await createDailyNoteIfNotExists(
            targetDate,
            makeFoamMock()
          );

          expect(result.uri.path).toMatch(/\/journal\/17-09-2021\.md$/);
          const doc = await showInEditor(result.uri);
          expect(doc.editor.document.getText()).toBe(
            '# Friday, September 17, 2021\n'
          );
          const templateUri = await getDailyNoteTemplateUri();
          expect(await readFile(templateUri)).toBe(
            legacyDailyNoteTemplate(settings, roots())
          );

          await deleteFile(templateUri);
          await deleteFile(result.uri);
        })
      );
    });

    it('asks to set the filepath when the template has none, and opens the template when asked', async () => {
      await closeEditors();
      const template = await createFile('# Day\n', DAILY_NOTE_TEMPLATE);

      await withLegacySettings(
        { directory: 'diary', fileExtension: 'txt' },
        () =>
          answeringWarning(OPEN_DAILY_NOTE_TEMPLATE_RESPONSE, async spy => {
            const result = await createDailyNoteIfNotExists(
              new Date(2021, 8, 15),
              makeFoamMock()
            );

            expect(result).toBeUndefined();
            expect(spy.mock.calls[0][0]).toBe(
              'foam.openDailyNote.directory and foam.openDailyNote.fileExtension are no longer used.'
            );
            expect((spy.mock.calls[0][1] as any).detail).toContain(
              legacyDailyNoteFrontmatter(
                { directory: 'diary', fileExtension: 'txt' },
                roots()
              )
            );
            expect(window.activeTextEditor.document.uri.path).toEqual(
              template.uri.path
            );
          })
      );

      await deleteFile(template.uri);
    });

    it('says a directory outside the workspace cannot be kept, offers nothing, and creates nothing', async () => {
      const settings = { directory: '/outside-the-workspace/diary' };
      const notice = ignoredDailyNoteSettingsNotice(
        undefined,
        settings,
        roots()
      );

      await withLegacySettings(settings, () =>
        answeringWarning(undefined, async spy => {
          const result = await createDailyNoteIfNotExists(
            new Date(2021, 8, 20),
            makeFoamMock()
          );

          expect(result).toBeUndefined();
          expect(spy.mock.calls).toEqual([
            [notice.message, { modal: true, detail: notice.detail }],
          ]);
          expect(await getDailyNoteTemplateUri()).toBeUndefined();
        })
      );
    });

    it('does not ask when the settings spell out what Foam does without them', async () => {
      await withLegacySettings(
        { directory: 'journal', fileExtension: 'md' },
        () =>
          answeringWarning(undefined, async spy => {
            const result = await createDailyNoteIfNotExists(
              new Date(2021, 7, 30),
              makeFoamMock()
            );

            expect(result.uri.path).toMatch(/\/journal\/2021-08-30\.md$/);
            expect(spy.mock.calls.map(([message]) => message)).toEqual([
              expect.stringMatching(/^No daily note template found/),
            ]);
            await deleteFile(result.uri);
          })
      );
    });

    it("does not ask once the template's filepath places daily notes", async () => {
      const template = await createFile(
        legacyDailyNoteTemplate({ directory: 'diary' }, roots()),
        DAILY_NOTE_TEMPLATE
      );
      const root = fromVsCodeUri(workspace.workspaceFolders[0].uri);

      await withLegacySettings({ directory: 'diary' }, () =>
        answeringWarning(undefined, async spy => {
          const result = await createDailyNoteIfNotExists(
            new Date(2021, 8, 16),
            makeFoamMock()
          );

          expect(spy).not.toHaveBeenCalled();
          expect(result.uri).toEqual(root.joinPath('diary', '2021-09-16.md'));
          await deleteFile(result.uri);
        })
      );

      await deleteFile(template.uri);
    });
  });

  describe('Links from date snippets', () => {
    it('name the daily note YYYY-MM-DD when there is no template', async () => {
      expect(await getDailyNoteLinks([new Date(2021, 8, 18)])).toEqual([
        '[[2021-09-18]]',
      ]);
    });

    it("name the daily note the way the template's filepath does", async () => {
      const template = await createFile(
        legacyDailyNoteTemplate(
          { directory: 'diary', filenameFormat: 'dd-mm-yyyy' },
          roots()
        ),
        DAILY_NOTE_TEMPLATE
      );

      expect(
        await getDailyNoteLinks([new Date(2021, 8, 18), new Date(2021, 8, 19)])
      ).toEqual(['[[18-09-2021]]', '[[19-09-2021]]']);

      await deleteFile(template.uri);
    });
  });

  describe('Template types and processing', () => {
    it('Processes Markdown templates correctly', async () => {
      const targetDate = new Date(2021, 8, 19);

      const template = await createFile(
        'hello ${FOAM_DATE_MONTH_NAME} ${FOAM_DATE_DATE} hello',
        DAILY_NOTE_TEMPLATE
      );

      const foam = makeFoamMock();
      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      const content = doc.editor.document.getText();
      expect(content).toEqual('hello September 19 hello');
      await deleteFile(result.uri);
      await deleteFile(template.uri);
    });

    it('Processes JavaScript templates correctly', async () => {
      const targetDate = new Date(2021, 8, 20);

      const jsTemplate = await createFile(
        `async function createNote ({ foamDate }) {
  const monthName = foamDate.toLocaleString('default', { month: 'long' });
  const day = foamDate.getDate();
  return {
    filepath: \`\${foamDate.getFullYear()}-\${String(foamDate.getMonth() + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}.md\`,
    content: \`# JS Template: \${monthName} \${day}\n\nGenerated by JavaScript template.\`
  };
};`,
        ['.foam', 'templates', 'daily-note.js']
      );

      const foam = makeFoamMock();
      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      const content = doc.editor.document.getText();
      expect(content).toContain('# JS Template: September 20');
      expect(content).toContain('Generated by JavaScript template.');

      await deleteFile(jsTemplate.uri);
      await deleteFile(result.uri);
    });

    it('Falls back to default text when no template exists', async () => {
      const targetDate = new Date(2021, 8, 21);
      const foam = makeFoamMock();
      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      const content = doc.editor.document.getText();
      expect(content).toContain('# 2021-09-21');
    });

    it('prompts to create a daily note template if one does not exist', async () => {
      const targetDate = new Date(2021, 8, 23);
      const foam = makeFoamMock();

      expect(await getDailyNoteTemplateUri()).not.toBeDefined();

      const showWarningMessageSpy = vi
        .spyOn(window, 'showWarningMessage')
        .mockResolvedValue(CREATE_DAILY_NOTE_WARNING_RESPONSE as any);

      await createDailyNoteIfNotExists(targetDate, foam);

      expect(showWarningMessageSpy.mock.calls[0][0]).toMatch(
        /No daily note template found/
      );

      // The warning handler is fire-and-forget, so wait for the template
      // file to be created asynchronously
      let templateUri: URI;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        templateUri = await getDailyNoteTemplateUri();
        if (templateUri) break;
        await new Promise(r => setTimeout(r, 50));
      }

      expect(templateUri).toBeDefined();
      expect(await fileExists(templateUri)).toBe(true);

      const templateContent = await readFile(templateUri);
      expect(templateContent).toContain('foam_template:');

      await deleteFile(templateUri);
      showWarningMessageSpy.mockRestore();
    });

    // The scaffold has to land where getDailyNoteTemplateUri looks, otherwise
    // the warning returns forever and the file appears somewhere the user
    // never configured.
    it('creates the daily note template in the configured templates folder', async () => {
      await withModifiedFoamConfiguration(
        'templates.folder',
        'my-templates',
        async () => {
          const foam = makeFoamMock();
          expect(await getDailyNoteTemplateUri()).not.toBeDefined();

          const showWarningMessageSpy = vi
            .spyOn(window, 'showWarningMessage')
            .mockResolvedValue(CREATE_DAILY_NOTE_WARNING_RESPONSE as any);
          try {
            await createDailyNoteIfNotExists(new Date(2021, 8, 24), foam);

            let templateUri: URI;
            const deadline = Date.now() + 2000;
            while (Date.now() < deadline) {
              templateUri = await getDailyNoteTemplateUri();
              if (templateUri) break;
              await new Promise(r => setTimeout(r, 50));
            }

            expect(templateUri).toBeDefined();
            expect(templateUri.path).toContain('my-templates/daily-note.md');
            await deleteFile(templateUri);
          } finally {
            showWarningMessageSpy.mockRestore();
          }
        }
      );
    });

    it('Processes template frontmatter metadata correctly', async () => {
      const targetDate = new Date(2021, 8, 22);

      const template = await createFile(
        `---
tags: [daily, journal]
author: foam
---
# Daily Note

Content here with \${FOAM_DATE_MONTH_NAME} \${FOAM_DATE_DATE}`,
        DAILY_NOTE_TEMPLATE
      );

      const foam = makeFoamMock();
      const result = await createDailyNoteIfNotExists(targetDate, foam);

      const doc = await showInEditor(result.uri);
      const content = doc.editor.document.getText();

      expect(content).toContain(`---
tags: [daily, journal]
author: foam
---`);
      expect(content).toContain('# Daily Note');
      expect(content).toContain('Content here with September 22');

      await deleteFile(template.uri);
      await deleteFile(result.uri);
    });
  });

  describe('Issue #1499 - Double template application with absolute paths', () => {
    it('should not apply template twice when reopening existing daily note with absolute filepath template', async () => {
      const targetDate = new Date(2021, 8, 25);
      const TEMPLATE_WITH_ABSOLUTE_FILEPATH = `---
foam_template:
  name: Daily note
  description: Daily note template
  filepath: '/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md'
---

# \${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE} - DAILY NOTE

Daily content here.`;

      const template = await createFile(
        TEMPLATE_WITH_ABSOLUTE_FILEPATH,
        DAILY_NOTE_TEMPLATE
      );

      const foam = makeFoamMock();

      // First call: Create the daily note
      const result1 = await createDailyNoteIfNotExists(targetDate, foam);
      expect(result1.didCreateFile).toBe(true);
      // The template's filepath decides where the note lands, not the settings
      const uri = result1.uri;

      const doc1 = await showInEditor(uri);
      const content1 = doc1.editor.document.getText();
      expect(content1).toContain('# 2021-09-25 - DAILY NOTE');
      expect(content1).toContain('Daily content here.');

      const templateOccurrences1 = (
        content1.match(/# 2021-09-25 - DAILY NOTE/g) || []
      ).length;
      expect(templateOccurrences1).toBe(1);

      await closeEditors();

      // Second call: reopen — must NOT apply the template again
      const result2 = await createDailyNoteIfNotExists(targetDate, foam);
      expect(result2.didCreateFile).toBe(false);

      const doc2 = await showInEditor(uri);
      const content2 = doc2.editor.document.getText();

      const templateOccurrences2 = (
        content2.match(/# 2021-09-25 - DAILY NOTE/g) || []
      ).length;
      expect(templateOccurrences2).toBe(1);
      expect(content2).toEqual(content1);

      await deleteFile(template.uri);
      await deleteFile(result1.uri);
    });
  });

  describe('Editor associations (#1742)', () => {
    it('opens an existing daily note in the editor associated with Markdown', async () => {
      await closeEditors();
      const { uri } = await createFile('# Existing Note', [
        'journal',
        '2021-10-04.md',
      ]);

      await withMarkdownEditorAssociation(async () => {
        await openDailyNoteFor(new Date(2021, 9, 4), makeFoamMock());

        expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
      });

      await deleteFile(uri);
    });

    it('opens an existing daily note in the text editor when nothing is associated with Markdown', async () => {
      await closeEditors();
      const { uri } = await createFile('# Existing Note', [
        'journal',
        '2021-10-05.md',
      ]);

      await openDailyNoteFor(new Date(2021, 9, 5), makeFoamMock());

      expect(getActiveTabViewType()).toBeUndefined();
      expect(window.activeTextEditor.document.uri.path).toEqual(uri.path);

      await deleteFile(uri);
    });

    // A new note is filled in as a snippet, which needs a text editor.
    const expectCreatedInTextEditorWithCursorAtEnd = async (
      targetDate: Date
    ) => {
      await closeEditors();
      const result = await createDailyNoteIfNotExists(
        targetDate,
        makeFoamMock()
      );

      expect(result.didCreateFile).toBe(true);
      expect(getActiveTabViewType()).toBeUndefined();
      const { document, selection } = window.activeTextEditor;
      expect(selection.active).toEqual(
        document.lineAt(document.lineCount - 1).range.end
      );

      await deleteFile(result.uri);
    };

    it('creates a daily note in the text editor with the cursor at the end', async () => {
      await expectCreatedInTextEditorWithCursorAtEnd(new Date(2021, 9, 6));
    });

    it('creates a daily note in the text editor with the cursor at the end, even with an association', async () => {
      await withMarkdownEditorAssociation(() =>
        expectCreatedInTextEditorWithCursorAtEnd(new Date(2021, 9, 7))
      );
    });
  });

  afterAll(async () => {
    await cleanWorkspace();
    await closeEditors();
  });
});

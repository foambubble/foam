import { URI } from '../model/uri';
import { FoamGraph } from '../model/graph';
import { FoamError } from '../common/errors';
import { LegacyDailyNoteSettings } from '../config';
import { resolveDailyNote } from './daily-note-resolver';
import { legacyDailyNoteTemplate } from './daily-note-location';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';

const NO_SETTINGS: LegacyDailyNoteSettings = {};

function makeReadFile(files: Record<string, string>) {
  return async (uri: URI): Promise<string> => {
    const content = files[uri.toFsPath()];
    if (content === undefined) {
      throw new Error(`File not found: ${uri.toFsPath()}`);
    }
    return content;
  };
}

function makeFoam(...roots: URI[]) {
  const workspace = createTestWorkspace(
    roots.length > 0 ? roots : [URI.file('/workspace')]
  );
  const graph = new FoamGraph(workspace);
  return { workspace, graph } as any;
}

describe('resolveDailyNote', () => {
  const date = new Date(2024, 0, 17); // January 17, 2024

  it('resolves filepath and content from a markdown template with foam_template.filepath', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
# \${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}`;

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.filepath.path).toContain('2024-01-17');
    expect(result.content).toContain('# 2024-01-17');
  });

  it('places the note in journal/ when the template has no filepath', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = '# Daily Note\n\nContent here.';

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.filepath.toFsPath()).toBe(
      URI.file('/workspace/journal/2024-01-17.md').toFsPath()
    );
  });

  it('creates journal/YYYY-MM-DD.md titled by the date when there is no template', async () => {
    const foam = makeFoam();

    const result = await resolveDailyNote(
      date,
      undefined,
      foam,
      makeReadFile({}),
      NO_SETTINGS
    );

    expect(result.filepath.toFsPath()).toBe(
      URI.file('/workspace/journal/2024-01-17.md').toFsPath()
    );
    expect(result.content).toBe('# 2024-01-17\n');
  });

  it('refuses while openDailyNote settings it no longer reads would have placed the note, saying how to keep them', async () => {
    const settings = { directory: 'diary', titleFormat: 'fullDate' };

    const result = resolveDailyNote(
      date,
      undefined,
      makeFoam(),
      makeReadFile({}),
      settings
    );

    await expect(result).rejects.toThrow(FoamError);
    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(result).rejects.toThrow(
      /foam\.openDailyNote\.directory and foam\.openDailyNote\.titleFormat are no longer used/
    );
    await expect(result).rejects.toThrow(
      legacyDailyNoteTemplate(settings, [URI.file('/workspace')])
    );
  });

  it('creates the note as usual when the openDailyNote settings spell out what Foam does without them', async () => {
    const result = await resolveDailyNote(
      date,
      undefined,
      makeFoam(),
      makeReadFile({}),
      { directory: 'journal', filenameFormat: 'yyyy-mm-dd', fileExtension: 'md' }
    );

    expect(result.filepath.toFsPath()).toBe(
      URI.file('/workspace/journal/2024-01-17.md').toFsPath()
    );
    expect(result.content).toBe('# 2024-01-17\n');
  });

  it('refuses without offering a template while the openDailyNote settings put daily notes outside the workspace, which a template cannot reach', async () => {
    const result = resolveDailyNote(
      date,
      undefined,
      makeFoam(),
      makeReadFile({}),
      { directory: '/home/me/diary' }
    );

    await expect(result).rejects.toThrow(
      'foam.openDailyNote.directory is no longer used. A daily note template cannot keep daily notes outside the workspace, where foam.openDailyNote.directory puts them.'
    );
    await expect(result).rejects.not.toThrow('foam_template');
  });

  it('refuses while the openDailyNote settings would have placed the note from a template without a filepath, naming the filepath to add', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const readFile = makeReadFile({ [templateUri.toFsPath()]: '# Day\n' });

    const result = resolveDailyNote(date, templateUri, makeFoam(), readFile, {
      fileExtension: 'txt',
      titleFormat: 'fullDate',
    });

    await expect(result).rejects.toThrow(
      /foam\.openDailyNote\.fileExtension is no longer used/
    );
    await expect(result).rejects.toThrow(
      "filepath: '/journal/${FOAM_DATE_FORMAT:YYYY-MM-DD}.txt'"
    );
  });

  it('creates the note where and as the openDailyNote settings did, from the template that reproduces them', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const readFile = makeReadFile({
      [templateUri.toFsPath()]: legacyDailyNoteTemplate(
        {
          directory: 'diary',
          filenameFormat: 'dd-mm-yyyy',
          fileExtension: 'markdown',
          titleFormat: 'fullDate',
        },
        [URI.file('/workspace')]
      ),
    });

    const result = await resolveDailyNote(
      date,
      templateUri,
      makeFoam(),
      readFile,
      NO_SETTINGS
    );

    expect(result.filepath.toFsPath()).toBe(
      URI.file('/workspace/diary/17-01-2024.markdown').toFsPath()
    );
    expect(result.content).toBe('# Wednesday, January 17, 2024\n');
  });

  // Where the old writer put a note for each directory, against where the
  // template built from it puts one
  it.each([
    ['an absolute directory inside the workspace', '/workspace/diary', [URI.file('/workspace')], '/workspace/diary/2024-01-17.md'],
    ['a directory named like the single root', 'journal', [URI.file('/home/me/journal')], '/home/me/journal/journal/2024-01-17.md'],
    ['a directory in a root other than the first', 'diary/daily', [URI.file('/ws/notes'), URI.file('/ws/diary')], '/ws/diary/daily/2024-01-17.md'],
    ['a directory in the first of several roots', 'daily', [URI.file('/ws/notes'), URI.file('/ws/diary')], '/ws/notes/daily/2024-01-17.md'],
  ])(
    'creates the note where the openDailyNote settings did, from the template that reproduces them, for %s',
    async (_, directory, roots, expected) => {
      const templateUri = roots[0].joinPath('.foam', 'templates', 'daily-note.md');
      const readFile = makeReadFile({
        [templateUri.toFsPath()]: legacyDailyNoteTemplate({ directory }, roots),
      });

      const result = await resolveDailyNote(
        date,
        templateUri,
        makeFoam(...roots),
        readFile,
        NO_SETTINGS
      );

      expect(result.filepath.toFsPath()).toBe(URI.file(expected).toFsPath());
    }
  );

  it('resolves FOAM_DATE_* variables in content', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
Year: \${FOAM_DATE_YEAR}
Month: \${FOAM_DATE_MONTH}
Day: \${FOAM_DATE_DATE}`;

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.content).toContain('Year: 2024');
    expect(result.content).toContain('Month: 01');
    expect(result.content).toContain('Day: 17');
  });

  it('resolves FOAM_TITLE to the date', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
Title: \${FOAM_TITLE}`;

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.content).toContain('Title: 2024-01-17');
  });

  it('uses locale for locale-sensitive date variables', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
Month: \${FOAM_DATE_MONTH_NAME}`;

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const enResult = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS,
      { locale: 'en-US' }
    );
    const jaResult = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS,
      { locale: 'ja-JP' }
    );

    expect(enResult.content).toContain('Month: January');
    expect(jaResult.content).toContain('Month: 1月');
  });

  // The lookup is wired here, not in the resolver: without this the variable
  // would resolve to nothing in every host that goes through resolveDailyNote.
  it('resolves FOAM_PREVIOUS_DAILY_NOTE against the workspace', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
Previous: [[\${FOAM_PREVIOUS_DAILY_NOTE}]]`;

    const foam = makeFoam();
    foam.workspace.set(
      createTestNote({ uri: '/workspace/journal/2024-01-15.md' })
    );
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.content).toContain('Previous: [[2024-01-15]]');
  });

  it('resolves FOAM_PREVIOUS_DAILY_NOTE in journal/ when the template has no filepath', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = 'Previous: [[${FOAM_PREVIOUS_DAILY_NOTE}]]';

    const foam = makeFoam();
    foam.workspace.set(
      createTestNote({ uri: '/workspace/journal/2024-01-15.md' })
    );
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.content).toBe('Previous: [[2024-01-15]]');
  });

  it('leaves FOAM_PREVIOUS_DAILY_NOTE to its fallback when no earlier note exists', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
Previous: \${FOAM_PREVIOUS_DAILY_NOTE:none yet}`;

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(
      date,
      templateUri,
      foam,
      readFile,
      NO_SETTINGS
    );

    expect(result.content).toContain('Previous: none yet');
  });
});

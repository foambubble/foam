import { URI } from '../model/uri';
import { FoamGraph } from '../model/graph';
import { resolveDailyNote } from './daily-note-resolver';
import { DailyNoteSettings } from './daily-note-location';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';

const NO_SETTINGS: DailyNoteSettings = {
  directory: null,
  filenameFormat: 'isoDate',
  fileExtension: 'md',
  titleFormat: null,
};

function makeReadFile(files: Record<string, string>) {
  return async (uri: URI): Promise<string> => {
    const content = files[uri.toFsPath()];
    if (content === undefined) {
      throw new Error(`File not found: ${uri.toFsPath()}`);
    }
    return content;
  };
}

function makeFoam(workspaceRoot = URI.file('/workspace')) {
  const workspace = createTestWorkspace([workspaceRoot]);
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

  it('places the note where the openDailyNote settings say when the template has no filepath', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = '# Daily Note\n\nContent here.';

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(date, templateUri, foam, readFile, {
      ...NO_SETTINGS,
      directory: 'diary',
    });

    expect(result.filepath.toFsPath()).toBe(
      URI.file('/workspace/diary/2024-01-17.md').toFsPath()
    );
  });

  it('creates a note titled by the openDailyNote settings when there is no template', async () => {
    const foam = makeFoam();

    const result = await resolveDailyNote(
      date,
      undefined,
      foam,
      makeReadFile({}),
      { ...NO_SETTINGS, titleFormat: 'fullDate' }
    );

    expect(result.filepath.toFsPath()).toBe(
      URI.file('/workspace/journal/2024-01-17.md').toFsPath()
    );
    expect(result.content).toBe('# Wednesday, January 17, 2024\n');
  });

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

  it('resolves FOAM_PREVIOUS_DAILY_NOTE where the settings put daily notes when the template has no filepath', async () => {
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

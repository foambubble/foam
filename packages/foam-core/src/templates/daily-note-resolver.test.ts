import { URI } from '../model/uri';
import { FoamGraph } from '../model/graph';
import { resolveDailyNote } from './daily-note-resolver';
import { createTestWorkspace } from '../../test/test-utils';

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

    const result = await resolveDailyNote(date, templateUri, foam, readFile);

    expect(result.filepath.path).toContain('2024-01-17');
    expect(result.content).toContain('# 2024-01-17');
  });

  it('uses fallbackFilepath when template has no filepath metadata', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = '# Daily Note\n\nContent here.';
    const fallbackFilepath = URI.file('/workspace/journal/2024-01-17.md');

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(date, templateUri, foam, readFile, {
      fallbackFilepath,
    });

    expect(result.filepath.toFsPath()).toBe(fallbackFilepath.toFsPath());
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

    const result = await resolveDailyNote(date, templateUri, foam, readFile);

    expect(result.content).toContain('Year: 2024');
    expect(result.content).toContain('Month: 01');
    expect(result.content).toContain('Day: 17');
  });

  it('injects pre-defined variables (e.g. FOAM_TITLE)', async () => {
    const templateUri = URI.file('/workspace/.foam/templates/daily-note.md');
    const templateContent = `---
foam_template:
  filepath: "/journal/\${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}.md"
---
Title: \${FOAM_TITLE}`;

    const foam = makeFoam();
    const readFile = makeReadFile({ [templateUri.toFsPath()]: templateContent });

    const result = await resolveDailyNote(date, templateUri, foam, readFile, {
      variables: new Map([['FOAM_TITLE', '2024-01-17']]),
    });

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

    const enResult = await resolveDailyNote(date, templateUri, foam, readFile, {
      locale: 'en-US',
    });
    const jaResult = await resolveDailyNote(date, templateUri, foam, readFile, {
      locale: 'ja-JP',
    });

    expect(enResult.content).toContain('Month: January');
    expect(jaResult.content).toContain('Month: 1月');
  });
});

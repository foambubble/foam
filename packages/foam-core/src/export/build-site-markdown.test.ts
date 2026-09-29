import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
  InMemoryDataStore,
} from '../../test/test-utils';
import { testExportTarget } from '../../test/test-export-target';
import { buildSite } from './index';

// Exports `note.md` with the given content and returns its exported markdown.
async function exportedMarkdown(content: string): Promise<string> {
  const root = URI.file('/');
  const dataStore = new InMemoryDataStore();
  const workspace = createTestWorkspace([root], dataStore);
  dataStore.set(root.joinPath('note.md'), content);
  workspace.set(createNoteFromMarkdown('note.md', content, root));
  const result = await buildSite(
    { workspace, graph: FoamGraph.fromWorkspace(workspace) },
    testExportTarget()
  );
  return result.notes[0].markdown;
}

describe('export buildSite note markdown', () => {
  it('drops the frontmatter and the title heading', async () => {
    expect(
      await exportedMarkdown('---\nstatus: draft\n---\n# Note\n\nBody')
    ).toBe('Body');
  });

  it('keeps the H1 when a frontmatter title replaces it', async () => {
    const markdown = await exportedMarkdown(
      '---\ntitle: Custom\n---\n# Heading\n\nBody'
    );
    expect(markdown).toBe('# Heading\n\nBody');
  });

  it('drops a setext title that follows a comment', async () => {
    const markdown = await exportedMarkdown(
      '<!-- omit in toc -->\n\nNote\n====\n\nBody'
    );
    expect(markdown).toContain('<!-- omit in toc -->');
    expect(markdown).toContain('Body');
    expect(markdown).not.toContain('Note');
    expect(markdown).not.toContain('===');
  });

  it('drops the title heading when text precedes it', async () => {
    const markdown = await exportedMarkdown('Intro\n\n# Heading\n\nBody');
    expect(markdown).toContain('Intro');
    expect(markdown).toContain('Body');
    expect(markdown).not.toContain('Heading');
  });

  it('keeps a note without an H1 as is', async () => {
    expect(await exportedMarkdown('## Section\n\nBody')).toBe(
      '## Section\n\nBody'
    );
  });
});

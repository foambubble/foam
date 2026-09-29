import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
  InMemoryDataStore,
} from '../../test/test-utils';
import { testExportTarget } from '../../test/test-export-target';
import { buildSite } from './index';
import { ExportedNote } from './types';

// Exports `note.md` with the given content, next to an `other.md` it can
// link to, and returns the exported note.
async function exportNote(content: string): Promise<ExportedNote> {
  const root = URI.file('/');
  const dataStore = new InMemoryDataStore();
  const workspace = createTestWorkspace([root], dataStore);
  dataStore.set(root.joinPath('note.md'), content);
  dataStore.set(root.joinPath('other.md'), '# Other');
  workspace
    .set(createNoteFromMarkdown('note.md', content, root))
    .set(createNoteFromMarkdown('other.md', '# Other', root));
  const result = await buildSite(
    { workspace, graph: FoamGraph.fromWorkspace(workspace) },
    testExportTarget()
  );
  return result.notes.find(n => n.route === '/note')!;
}

describe('export buildSite note markdown', () => {
  it('keeps the whole source in `markdown`, with links rewritten', async () => {
    const note = await exportNote(
      '---\nstatus: draft\n---\n# Note\n\nSee [[other]].'
    );
    expect(note.markdown).toBe(
      '---\nstatus: draft\n---\n# Note\n\nSee [Other](/other).'
    );
  });
});

describe('export buildSite note body', () => {
  it('drops the frontmatter and the title heading', async () => {
    const note = await exportNote('---\nstatus: draft\n---\n# Note\n\nBody');
    expect(note.body).toBe('Body');
  });

  it('keeps the H1 when a frontmatter title replaces it', async () => {
    const note = await exportNote('---\ntitle: Custom\n---\n# Heading\n\nBody');
    expect(note.body).toBe('# Heading\n\nBody');
  });

  it('drops the H1 when the frontmatter title matches it', async () => {
    const note = await exportNote('---\ntitle: Note\n---\n# Note\n\nBody');
    expect(note.body).toBe('Body');
  });

  it('drops a title heading that ends with a block anchor', async () => {
    const note = await exportNote('# Anchored ^abc\n\nBody');
    expect(note.body).toBe('Body');
  });

  it('drops a setext title that follows a comment', async () => {
    const note = await exportNote('<!-- omit in toc -->\n\nNote\n====\n\nBody');
    expect(note.body).toContain('<!-- omit in toc -->');
    expect(note.body).toContain('Body');
    expect(note.body).not.toContain('Note');
    expect(note.body).not.toContain('===');
  });

  it('drops the title heading when text precedes it', async () => {
    const note = await exportNote('Intro\n\n# Heading\n\nBody');
    expect(note.body).toContain('Intro');
    expect(note.body).toContain('Body');
    expect(note.body).not.toContain('Heading');
  });

  it('keeps an indented code block that follows the title', async () => {
    const note = await exportNote('# Note\n\n    code line\n\nBody');
    expect(note.body).toBe('    code line\n\nBody');
  });

  it('keeps a note without an H1 as is', async () => {
    const note = await exportNote('## Section\n\nBody');
    expect(note.body).toBe('## Section\n\nBody');
  });
});

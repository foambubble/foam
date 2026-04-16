import { URI } from '../core/model/uri';
import { Logger } from '../core/utils/log';
import { TextEdit } from '../core/services/text-edit';
import {
  InMemoryDataStore,
  createTestWorkspace,
  createNoteFromMarkdown,
} from '../test/test-utils';
import { computeNoteEdits } from './janitor';

Logger.setLevel('error');

const makeWorkspace = async (notes: { uri: string; content: string }[]) => {
  const dataStore = new InMemoryDataStore();
  const workspace = createTestWorkspace([URI.file('/')], dataStore);
  for (const { uri, content } of notes) {
    const foamUri = URI.file(uri);
    dataStore.set(foamUri, content);
    workspace.set(createNoteFromMarkdown(uri, content));
  }
  return { workspace, dataStore };
};

describe('computeNoteEdits', () => {
  it('returns no edits for a note that needs no changes', async () => {
    const content = '# Already has a heading\n\nSome content.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const edits = computeNoteEdits(note, content, '\n', workspace, 'off');

    expect(edits).toHaveLength(0);
  });

  it('returns a heading edit for a note missing one', async () => {
    const content = 'No heading here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const edits = computeNoteEdits(note, content, '\n', workspace, 'off');

    expect(edits).toHaveLength(1);
    expect(edits[0].newText).toContain('# Note');
    expect(edits[0].range.start.line).toEqual(0);
    expect(edits[0].range.start.character).toEqual(0);
    const result = TextEdit.apply(content, edits);
    expect(result).toEqual('# Note\n\nNo heading here.\n');
  });

  it('inserts heading after frontmatter when frontmatter is present', async () => {
    const content = '---\ntitle: foo\n---\nNo heading here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const edits = computeNoteEdits(note, content, '\n', workspace, 'off');

    expect(edits).toHaveLength(1);
    expect(edits[0].newText).toContain('# Note');
    expect(edits[0].range.start.line).toEqual(2);
    expect(edits[0].range.start.character).toEqual(0);
    const result = TextEdit.apply(content, edits);
    expect(result).toEqual(
      '---\ntitle: foo\n\n# Note\n\n---\nNo heading here.\n'
    );
  });

  it('returns definition edits when wikilink setting is noExtensions', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const edits = computeNoteEdits(
      note,
      content,
      '\n',
      workspace,
      'noExtensions'
    );

    expect(edits.length).toBeGreaterThan(0);
    const result = TextEdit.apply(content, edits);
    expect(result).toContain('[other]: other');
  });

  it('returns no definition edits when wikilink setting is off', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const edits = computeNoteEdits(note, content, '\n', workspace, 'off');

    expect(edits).toHaveLength(0);
  });

  it('returns both heading and definition edits when both are needed', async () => {
    const content = 'No heading.\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const edits = computeNoteEdits(
      note,
      content,
      '\n',
      workspace,
      'noExtensions'
    );

    expect(edits.length).toBeGreaterThan(1);
    const result = TextEdit.apply(content, edits);
    expect(result).toContain('# Note');
    expect(result).toContain('[other]: other');
  });
});

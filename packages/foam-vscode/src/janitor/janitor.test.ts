import { URI } from '../core/model/uri';
import { Logger } from '../core/utils/log';
import { TextEdit } from '../core/services/text-edit';
import {
  InMemoryDataStore,
  createTestWorkspace,
  createNoteFromMarkdown,
} from '../test/test-utils';
import { computeNonDirtyEdits, computeDirtyEdits } from './janitor';

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

describe('computeNonDirtyEdits', () => {
  it('returns nothing for notes that need no changes', async () => {
    const content = '# Already has a heading\n\nSome content.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeNonDirtyEdits([note], workspace, 'off');

    expect(result).toHaveLength(0);
  });

  it('does not add a heading (heading generation is currently a no-op when note has a title)', async () => {
    // generateHeading returns null whenever note.title is set, which it always
    // is after parsing (title defaults to filename). See the TODO in generate-headings.ts.
    const content = 'No heading here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeNonDirtyEdits([note], workspace, 'off');

    expect(result).toHaveLength(0);
  });

  it('adds link definitions when wikilink setting is noExtensions', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;
    const other = workspace.find(URI.file('/other.md'))!;
    const result = await computeNonDirtyEdits(
      [note, other],
      workspace,
      'noExtensions'
    );

    expect(result).toHaveLength(1);
    expect(result[0].addedHeading).toBe(false);
    expect(result[0].addedDefinitions).toBe(true);
    expect(result[0].updatedText).toContain('[other]: other');
  });

  it('skips link definitions when wikilink setting is off', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeNonDirtyEdits([note], workspace, 'off');

    expect(result).toHaveLength(0);
  });

  it('adds definitions (heading generation is a no-op but definitions are applied)', async () => {
    // generateHeading is currently a no-op when note.title is set (see generate-headings.ts TODO),
    // so only definitions are added.
    const content = 'No heading.\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeNonDirtyEdits(
      [note],
      workspace,
      'noExtensions'
    );

    expect(result).toHaveLength(1);
    expect(result[0].addedHeading).toBe(false);
    expect(result[0].addedDefinitions).toBe(true);
    expect(result[0].updatedText).toContain('[other]: other');
  });

  it('processes multiple notes independently and only returns changed ones', async () => {
    const { workspace } = await makeWorkspace([
      { uri: '/clean.md', content: '# Clean\n\nNo changes needed.\n' },
      { uri: '/has-wikilink.md', content: '# Has wikilink\n\n[[clean]]\n' },
    ]);
    const notes = [
      workspace.find(URI.file('/clean.md'))!,
      workspace.find(URI.file('/has-wikilink.md'))!,
    ];

    const result = await computeNonDirtyEdits(notes, workspace, 'noExtensions');

    expect(result).toHaveLength(1);
    expect(result[0].uri.path).toContain('has-wikilink');
    expect(result[0].addedDefinitions).toBe(true);
  });
});

describe('computeDirtyEdits', () => {
  it('returns null heading and empty definitions for a clean note', async () => {
    const content = '# Already has a heading\n\nSome content.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeDirtyEdits(
      note,
      content,
      '\n',
      workspace,
      'off'
    );

    expect(result.heading).toBeNull();
    expect(result.definitions).toHaveLength(0);
  });

  it('returns null heading even when note has no markdown heading (heading generation is a no-op when note has a title)', async () => {
    // generateHeading returns null when note.title is set (see generate-headings.ts TODO).
    const content = 'No heading here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeDirtyEdits(
      note,
      content,
      '\n',
      workspace,
      'off'
    );

    expect(result.heading).toBeNull();
    expect(result.definitions).toHaveLength(0);
  });

  it('returns definition edits when wikilinks are present and setting is noExtensions', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeDirtyEdits(
      note,
      content,
      '\n',
      workspace,
      'noExtensions'
    );

    expect(result.heading).toBeNull();
    expect(result.definitions.length).toBeGreaterThan(0);
    const applied = TextEdit.apply(content, result.definitions);
    expect(applied).toContain('[other]: other');
  });

  it('returns no definitions when wikilink setting is off', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeDirtyEdits(
      note,
      content,
      '\n',
      workspace,
      'off'
    );

    expect(result.definitions).toHaveLength(0);
  });

  it('returns definitions even when heading generation is a no-op', async () => {
    const content = 'No heading.\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const result = await computeDirtyEdits(
      note,
      content,
      '\n',
      workspace,
      'noExtensions'
    );

    expect(result.heading).toBeNull();
    expect(result.definitions.length).toBeGreaterThan(0);
  });
});

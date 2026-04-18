import { URI } from '../core/model/uri';
import { Logger } from '../core/utils/log';
import { TextEdit } from '../core/services/text-edit';
import {
  InMemoryDataStore,
  createTestWorkspace,
  createNoteFromMarkdown,
} from '../test/test-utils';
import {
  computeNoteEdits,
  lintNote,
  lintWorkspace,
  missingHeadingRule,
  staleDefinitionsRule,
} from './janitor';

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

describe('missingHeadingRule', () => {
  it('returns no issues for a note with an h1', async () => {
    const content = '# Already has a heading\n\nSome content.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;
    const rule = missingHeadingRule();

    const issues = rule.check(note, content, '\n', workspace);

    expect(issues).toHaveLength(0);
  });

  it('returns a missing-heading issue with a fix for a note without h1', async () => {
    const content = 'No heading here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;
    const rule = missingHeadingRule();

    const issues = rule.check(note, content, '\n', workspace);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('missing-heading');
    expect(issues[0].fix).toHaveLength(1);
    expect(issues[0].fix![0].uri.path).toEqual('/note.md');
    const result = TextEdit.apply(content, [issues[0].fix![0].edit]);
    expect(result).toEqual('# Note\n\nNo heading here.\n');
  });

  it('inserts heading after frontmatter for a note with only frontmatter', async () => {
    const content = '---\nnoTitle: true\n---\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;
    const rule = missingHeadingRule();

    const issues = rule.check(note, content, '\n', workspace);

    expect(issues).toHaveLength(1);
    const result = TextEdit.apply(content, [issues[0].fix![0].edit]);
    expect(result).toEqual('---\nnoTitle: true\n---\n\n# Note\n');
  });
});

describe('staleDefinitionsRule', () => {
  it('returns no issues for a note without wikilinks', async () => {
    const content = '# Note\n\nNo wikilinks here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;
    const rule = staleDefinitionsRule('withoutExtensions');

    const issues = rule.check(note, content, '\n', workspace);

    expect(issues).toHaveLength(0);
  });

  it('returns stale-definitions issues with fixes when wikilinks are present', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;
    const rule = staleDefinitionsRule('withoutExtensions');

    const issues = rule.check(note, content, '\n', workspace);

    expect(issues.some(i => i.code === 'stale-definitions')).toBe(true);
    expect(issues.every(i => i.fix !== undefined)).toBe(true);
    const edits = issues.flatMap(i => i.fix!.map(f => f.edit));
    const result = TextEdit.apply(content, edits);
    expect(result).toContain('[other]: other');
  });
});

describe('lintNote', () => {
  it('returns no issues for a clean note', async () => {
    const content = '# Already has a heading\n\nSome content.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const issues = lintNote(note, content, '\n', workspace, 'off');

    expect(issues).toHaveLength(0);
  });

  it('returns a missing-heading issue with a fix for a note without h1', async () => {
    const content = 'No heading here.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);
    const note = workspace.find(URI.file('/note.md'))!;

    const issues = lintNote(note, content, '\n', workspace, 'off');

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('missing-heading');
    expect(issues[0].fix).toHaveLength(1);
    expect(issues[0].fix![0].uri.path).toEqual('/note.md');
    const result = TextEdit.apply(content, [issues[0].fix![0].edit]);
    expect(result).toEqual('# Note\n\nNo heading here.\n');
  });

  it('returns stale-definitions issues with fixes when wikilinks are present', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);
    const note = workspace.find(URI.file('/note.md'))!;

    const issues = lintNote(note, content, '\n', workspace, 'withoutExtensions');

    expect(issues.some(i => i.code === 'stale-definitions')).toBe(true);
    expect(issues.every(i => i.fix !== undefined)).toBe(true);
    const edits = issues.flatMap(i => i.fix!.map(f => f.edit));
    const result = TextEdit.apply(content, edits);
    expect(result).toContain('[other]: other');
  });
});

describe('lintWorkspace', () => {
  it('returns empty entries when all notes are clean', async () => {
    const content = '# Clean Note\n\nSome content.\n';
    const { workspace } = await makeWorkspace([{ uri: '/note.md', content }]);

    const results = await lintWorkspace(workspace, [missingHeadingRule()]);

    expect(results.entries).toHaveLength(0);
  });

  it('returns one entry per note with problems, accessible by URI', async () => {
    const { workspace } = await makeWorkspace([
      { uri: '/clean.md', content: '# Clean\n\nOk.\n' },
      { uri: '/dirty.md', content: 'No heading.\n' },
    ]);

    const results = await lintWorkspace(workspace, [missingHeadingRule()]);

    expect(results.entries).toHaveLength(1);
    expect(results.has(URI.file('/dirty.md'))).toBe(true);
    expect(results.has(URI.file('/clean.md'))).toBe(false);
    expect(results.get(URI.file('/dirty.md'))![0].code).toBe('missing-heading');
  });

  it('runs only the rules provided', async () => {
    const content = '# Note\n\n[[other]]\n';
    const { workspace } = await makeWorkspace([
      { uri: '/note.md', content },
      { uri: '/other.md', content: '# Other\n' },
    ]);

    const results = await lintWorkspace(workspace, [missingHeadingRule()]);

    const issues = results.entries.flatMap(r => r.issues);
    expect(issues.every(i => i.code !== 'stale-definitions')).toBe(true);
  });

  it('calls progress callback for each note', async () => {
    const { workspace } = await makeWorkspace([
      { uri: '/a.md', content: '# A\n' },
      { uri: '/b.md', content: '# B\n' },
    ]);
    const calls: number[] = [];

    await lintWorkspace(workspace, [missingHeadingRule()], progress => {
      calls.push(progress.current);
    });

    expect(calls).toEqual([1, 2]);
  });
});

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
    expect(edits[0].range.start.line).toEqual(3);
    expect(edits[0].range.start.character).toEqual(0);
    const result = TextEdit.apply(content, edits);
    expect(result).toEqual(
      '---\ntitle: foo\n---\n\n# Note\n\nNo heading here.\n'
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
      'withoutExtensions'
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
      'withoutExtensions'
    );

    expect(edits.length).toBeGreaterThan(1);
    const result = TextEdit.apply(content, edits);
    expect(result).toContain('# Note');
    expect(result).toContain('[other]: other');
  });
});

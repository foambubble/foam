import {
  computeWikilinkRenameEdits,
  computeDirectoryWikilinkRenameEdits,
} from './refactor';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
} from '../test/test-utils';
import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { Foam } from '../core/model/foam';
import { Resource } from '../core/model/note';

const root = URI.file('/workspace');

function createFoam(...notes: Resource[]): Foam {
  const workspace = createTestWorkspace([root]);
  notes.forEach(n => workspace.set(n));
  const graph = FoamGraph.fromWorkspace(workspace);
  return { workspace, graph } as unknown as Foam;
}

describe('computeWikilinkRenameEdits', () => {
  it('returns empty array when the note has no backlinks', () => {
    const noteA = createNoteFromMarkdown('note-a.md', 'Content of A', root);
    const foam = createFoam(noteA);

    const edits = computeWikilinkRenameEdits(
      foam,
      noteA.uri,
      root.resolve('renamed.md')
    );

    expect(edits).toEqual([]);
  });

  it('updates the wikilink identifier when a note is renamed', () => {
    const noteA = createNoteFromMarkdown('note-a.md', 'Content of A', root);
    const noteB = createNoteFromMarkdown(
      'note-b.md',
      'Link to [[note-a]]',
      root
    );
    const foam = createFoam(noteA, noteB);
    const newUri = root.resolve('renamed-note-a.md');

    const edits = computeWikilinkRenameEdits(foam, noteA.uri, newUri);

    expect(edits).toHaveLength(1);
    expect(edits[0].uri).toEqual(noteB.uri);
    expect(edits[0].edit.newText).toEqual('[[renamed-note-a]]');
  });

  it('uses the best identifier based on the new note location', () => {
    const noteA = createNoteFromMarkdown(
      'refactor/wikilink/first/note-a.md',
      'Content of A',
      root
    );
    const noteB = createNoteFromMarkdown(
      'refactor/wikilink/second/note-b.md',
      'Content of B',
      root
    );
    const noteC = createNoteFromMarkdown(
      'note-c.md',
      'Link to [[note-a]]',
      root
    );
    const foam = createFoam(noteA, noteB, noteC);
    // Rename note-a to first/note-b — now ambiguous with second/note-b
    const newUri = root.resolve('refactor/wikilink/first/note-b.md');

    const edits = computeWikilinkRenameEdits(foam, noteA.uri, newUri);

    expect(edits[0].edit.newText).toEqual('[[first/note-b]]');
  });

  it('uses the best identifier when moving a note to another directory', () => {
    const noteA = createNoteFromMarkdown(
      'refactor/wikilink/first/note-a.md',
      'Content of A',
      root
    );
    const noteB = createNoteFromMarkdown(
      'refactor/wikilink/second/note-b.md',
      'Content of B',
      root
    );
    const noteC = createNoteFromMarkdown(
      'note-c.md',
      'Link to [[note-a]]',
      root
    );
    const foam = createFoam(noteA, noteB, noteC);
    // Moving note-a into second/ — still unique, so short identifier suffices
    const newUri = root.resolve('refactor/wikilink/second/note-a.md');

    const edits = computeWikilinkRenameEdits(foam, noteA.uri, newUri);

    expect(edits[0].edit.newText).toEqual('[[note-a]]');
  });

  it('preserves the alias when updating a wikilink', () => {
    const noteA = createNoteFromMarkdown('note-a.md', 'Content of A', root);
    const noteB = createNoteFromMarkdown(
      'note-b.md',
      'Link to [[note-a|Alias]]',
      root
    );
    const foam = createFoam(noteA, noteB);
    const newUri = root.resolve('new-note-a.md');

    const edits = computeWikilinkRenameEdits(foam, noteA.uri, newUri);

    expect(edits[0].edit.newText).toEqual('[[new-note-a|Alias]]');
  });

  it('preserves the section when updating a wikilink', () => {
    const noteA = createNoteFromMarkdown('note-a.md', 'Content of A', root);
    const noteB = createNoteFromMarkdown(
      'note-b.md',
      'Link to [[note-a#Section]]',
      root
    );
    const foam = createFoam(noteA, noteB);
    const newUri = root.resolve('new-note-with-section.md');

    const edits = computeWikilinkRenameEdits(foam, noteA.uri, newUri);

    expect(edits[0].edit.newText).toEqual('[[new-note-with-section#Section]]');
  });

  it('does not return edits for markdown links (delegated to VS Code built-in)', () => {
    const noteA = createNoteFromMarkdown('note-a.md', 'Content of A', root);
    const noteB = createNoteFromMarkdown(
      'note-b.md',
      'Link to [[note-a]] and [direct](./note-a.md)',
      root
    );
    const foam = createFoam(noteA, noteB);
    const newUri = root.resolve('renamed.md');

    const edits = computeWikilinkRenameEdits(foam, noteA.uri, newUri);

    // Only the wikilink should produce an edit; the markdown link should be skipped
    expect(edits).toHaveLength(1);
    expect(edits[0].edit.newText).toEqual('[[renamed]]');
  });
});

describe('computeDirectoryWikilinkRenameEdits', () => {
  it('returns empty array when no Foam resources are inside the directory', () => {
    const outside = createNoteFromMarkdown('outside.md', 'Content', root);
    const foam = createFoam(outside);
    const oldDirUri = URI.file('/empty-folder');
    const newDirUri = URI.file('/renamed-folder');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits).toEqual([]);
  });

  it('updates qualified wikilinks pointing to files inside the renamed folder', () => {
    // note-a exists in two folders, so it must be qualified as [[folderA/note-a]]
    const noteA = createNoteFromMarkdown(
      'folderA/note-a.md',
      'Content of A',
      root
    );
    const conflict = createNoteFromMarkdown(
      'other/note-a.md',
      'Conflicting note',
      root
    );
    const outside = createNoteFromMarkdown(
      'outside.md',
      'Link to [[folderA/note-a]]',
      root
    );
    const foam = createFoam(noteA, conflict, outside);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits).toHaveLength(1);
    expect(edits[0].uri).toEqual(outside.uri);
    expect(edits[0].edit.newText).toEqual('[[folderB/note-a]]');
  });

  it('produces a no-op edit for unique wikilinks that remain unique after rename', () => {
    // unique-note has no basename conflicts — link is [[unique-note]] before and after
    const noteA = createNoteFromMarkdown(
      'folderA/unique-note.md',
      'Content',
      root
    );
    const outside = createNoteFromMarkdown(
      'outside.md',
      'Link to [[unique-note]]',
      root
    );
    const foam = createFoam(noteA, outside);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits).toHaveLength(1);
    expect(edits[0].edit.newText).toEqual('[[unique-note]]');
  });

  it('correctly disambiguates files within the renamed folder that share a basename', () => {
    // Both files have basename 'note', forcing path-qualified identifiers
    const noteA = createNoteFromMarkdown(
      'folderA/note.md',
      'Content of A',
      root
    );
    const noteSub = createNoteFromMarkdown(
      'folderA/sub/note.md',
      'Content of Sub',
      root
    );
    // Current identifiers: [[folderA/note]] and [[sub/note]]
    const outside = createNoteFromMarkdown(
      'outside.md',
      'Links to [[folderA/note]] and [[sub/note]]',
      root
    );
    const foam = createFoam(noteA, noteSub, outside);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    // With the future workspace, folderB/note and folderB/sub/note correctly
    // compete with each other — the naive exclude-only approach would return
    // 'note' for both (ambiguous).
    expect(edits.some(e => e.edit.newText === '[[folderB/note]]')).toBe(true);
    expect(edits.every(e => e.edit.newText !== '[[note]]')).toBe(true);
  });

  it('updates wikilinks inside the folder pointing to other files inside the same folder', () => {
    const noteA = createNoteFromMarkdown(
      'folderA/note-a.md',
      'Content of A',
      root
    );
    const conflict = createNoteFromMarkdown(
      'other/note-a.md',
      'Conflicting',
      root
    );
    // noteB is inside folderA and links to noteA (also inside folderA)
    const noteB = createNoteFromMarkdown(
      'folderA/note-b.md',
      'Link to [[folderA/note-a]]',
      root
    );
    const foam = createFoam(noteA, conflict, noteB);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    // The edit goes to noteB's old URI (it will be renamed to folderB/note-b.md by VS Code)
    expect(edits).toHaveLength(1);
    expect(edits[0].uri).toEqual(noteB.uri);
    expect(edits[0].edit.newText).toEqual('[[folderB/note-a]]');
  });

  it('updates directory-style wikilinks [[folderA]] → [[folderB]] when the directory is renamed', () => {
    // folderA/index.md is the directory index, so it can be linked as [[folderA]]
    const index = createNoteFromMarkdown(
      'folderA/index.md',
      'Index of folderA',
      root
    );
    const outside = createNoteFromMarkdown(
      'outside.md',
      'Link to [[folderA]]',
      root
    );
    const foam = createFoam(index, outside);
    const oldDirUri = index.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits).toHaveLength(1);
    expect(edits[0].edit.newText).toEqual('[[folderB]]');
  });

  it('does not produce edits for links from inside the folder pointing outside', () => {
    // noteA links to outside, but we only care about backlinks of noteA (there are none)
    const noteA = createNoteFromMarkdown(
      'folderA/note-a.md',
      'Link to [[outside]]',
      root
    );
    const outside = createNoteFromMarkdown('outside.md', 'Content', root);
    const foam = createFoam(noteA, outside);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits).toEqual([]);
  });

  it('preserves aliases when updating wikilinks to files inside the renamed folder', () => {
    const noteA = createNoteFromMarkdown(
      'folderA/note-a.md',
      'Content of A',
      root
    );
    const conflict = createNoteFromMarkdown(
      'other/note-a.md',
      'Conflicting',
      root
    );
    const outside = createNoteFromMarkdown(
      'outside.md',
      'Link to [[folderA/note-a|My Alias]]',
      root
    );
    const foam = createFoam(noteA, conflict, outside);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits[0].edit.newText).toEqual('[[folderB/note-a|My Alias]]');
  });

  it('preserves section anchors when updating wikilinks to files inside the renamed folder', () => {
    const noteA = createNoteFromMarkdown(
      'folderA/note-a.md',
      'Content of A',
      root
    );
    const conflict = createNoteFromMarkdown(
      'other/note-a.md',
      'Conflicting',
      root
    );
    const outside = createNoteFromMarkdown(
      'outside.md',
      'Link to [[folderA/note-a#Section]]',
      root
    );
    const foam = createFoam(noteA, conflict, outside);
    const oldDirUri = noteA.uri.getDirectory();
    const newDirUri = URI.file('/folderB');

    const edits = computeDirectoryWikilinkRenameEdits(
      foam,
      oldDirUri,
      newDirUri
    );

    expect(edits[0].edit.newText).toEqual('[[folderB/note-a#Section]]');
  });
});

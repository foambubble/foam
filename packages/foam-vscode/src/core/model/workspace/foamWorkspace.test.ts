import { FoamWorkspace } from './foamWorkspace';
import { Logger } from '../../utils/log';
import { URI } from '.././uri';
import { createTestNote, createTestWorkspace } from '../../../test/test-utils';
import { TrieIdentifier } from './workspace';

Logger.setLevel('error');

describe('Workspace resources', () => {
  it('should allow adding notes to the workspace', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/page-a.md' }));
    ws.set(createTestNote({ uri: '/page-b.md' }));
    ws.set(createTestNote({ uri: '/page-c.md' }));

    expect(
      ws
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-a.md', '/page-b.md', '/page-c.md']);
  });

  it('should includes all notes when listing resources', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/page-a.md' }));
    ws.set(createTestNote({ uri: '/file.pdf' }));

    expect(
      ws
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/file.pdf', '/page-a.md']);
  });

  it('should fail when trying to get a non-existing note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA);

    const uri = URI.file('/path/to/another/page-b.md');
    expect(ws.exists(uri)).toBeFalsy();
    expect(ws.find(uri)).toBeNull();
    expect(() => ws.get(uri)).toThrow();
  });

  it('should work with a resource named like a JS prototype property', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({ uri: '/somewhere/constructor.md' });
    ws.set(noteA);
    expect(ws.list()).toEqual([noteA]);
  });

  it('should not return files with same suffix when listing by ID - #851', () => {
    const ws = createTestWorkspace()
      .set(createTestNote({ uri: 'test-file.md' }))
      .set(createTestNote({ uri: 'file.md' }));
    expect(ws.getTrieIdentifier().listByIdentifier('file').length).toEqual(1);
  });

  it('should support dendron-style names', () => {
    const ws = createTestWorkspace()
      .set(createTestNote({ uri: 'note.pdf' }))
      .set(createTestNote({ uri: 'note.md' }))
      .set(createTestNote({ uri: 'note.yo.md' }))
      .set(createTestNote({ uri: 'note2.md' }));
    for (const [reference, path] of [
      ['note', '/note.md'],
      ['note.md', '/note.md'],
      ['note.yo', '/note.yo.md'],
      ['note.yo.md', '/note.yo.md'],
      ['note.pdf', '/note.pdf'],
      ['note2', '/note2.md'],
    ]) {
      expect(
        ws.getTrieIdentifier().listByIdentifier(reference)[0].uri.path
      ).toEqual(path);
      expect(ws.find(reference).uri.path).toEqual(path);
    }
  });

  it('should keep the fragment information when finding a resource', () => {
    const ws = createTestWorkspace()
      .set(createTestNote({ uri: 'test-file.md' }))
      .set(createTestNote({ uri: 'file.md' }));

    const res = ws.find('test-file#my-section');
    expect(res.uri.fragment).toEqual('my-section');
  });

  it('should find absolute files even when no basedir is provided', () => {
    const noteA = createTestNote({ uri: '/a/path/to/file.md' });
    const ws = createTestWorkspace().set(noteA);

    expect(ws.find('/a/path/to/file.md').uri.path).toEqual(noteA.uri.path);
  });
});

describe('Identifier computation', () => {
  it('should compute the minimum identifier to resolve a name clash', () => {
    const first = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const second = createTestNote({
      uri: '/another/way/for/page-a.md',
    });
    const third = createTestNote({
      uri: '/another/path/for/page-a.md',
    });
    const ws = new FoamWorkspace('.md').set(first).set(second).set(third);

    expect(ws.getTrieIdentifier().getIdentifier(first.uri)).toEqual(
      'to/page-a'
    );
    expect(ws.getTrieIdentifier().getIdentifier(second.uri)).toEqual(
      'way/for/page-a'
    );
    expect(ws.getTrieIdentifier().getIdentifier(third.uri)).toEqual(
      'path/for/page-a'
    );
  });

  it('should support sections in identifier computation', () => {
    const first = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const second = createTestNote({
      uri: '/another/way/for/page-a.md',
    });
    const third = createTestNote({
      uri: '/another/path/for/page-a.md',
    });
    const ws = new FoamWorkspace('.md').set(first).set(second).set(third);

    expect(
      ws
        .getTrieIdentifier()
        .getIdentifier(first.uri.with({ fragment: 'section name' }))
    ).toEqual('to/page-a#section name');
  });

  const needle = '/project/car/todo';

  test.each([
    [['/project/home/todo', '/other/todo', '/something/else'], 'car/todo'],
    [['/family/car/todo', '/other/todo'], 'project/car/todo'],
    [[], 'todo'],
  ])('should find shortest identifier', (haystack, id) => {
    expect(TrieIdentifier.getShortest(needle, haystack)).toEqual(id);
  });

  it('should ignore same string in haystack', () => {
    const haystack = [
      needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];
    const identifier = TrieIdentifier.getShortest(needle, haystack);
    expect(identifier).toEqual('car/todo');
  });

  it('should return the best guess when no solution is possible', () => {
    /**
     * In this case there is no way to uniquely identify the element,
     * our fallback is to just return the "least wrong" result, basically
     * a full identifier
     * This is an edge case that should never happen in a real repo
     */
    const haystack = [
      '/parent/' + needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];
    const identifier = TrieIdentifier.getShortest(needle, haystack);
    expect(identifier).toEqual('project/car/todo');
  });

  it('should ignore elements from the exclude list', () => {
    const workspace = new FoamWorkspace('.md');
    const noteA = createTestNote({ uri: '/path/to/note-a.md' });
    const noteB = createTestNote({ uri: '/path/to/note-b.md' });
    const noteC = createTestNote({ uri: '/path/to/note-c.md' });
    const noteD = createTestNote({ uri: '/path/to/note-d.md' });
    const noteABis = createTestNote({ uri: '/path/to/another/note-a.md' });

    workspace.set(noteA).set(noteB).set(noteC).set(noteD);
    expect(workspace.getTrieIdentifier().getIdentifier(noteABis.uri)).toEqual(
      'another/note-a'
    );
    expect(
      workspace
        .getTrieIdentifier()
        .getIdentifier(noteABis.uri, [noteB.uri, noteA.uri])
    ).toEqual('note-a');
  });

  it('should handle case-sensitive filenames correctly (#1303)', () => {
    const workspace = new FoamWorkspace('.md');
    const noteUppercase = createTestNote({ uri: '/a/Note.md' });
    const noteLowercase = createTestNote({ uri: '/b/note.md' });

    workspace.set(noteUppercase).set(noteLowercase);

    // Should find exact case matches
    expect(
      workspace.getTrieIdentifier().listByIdentifier('Note').length
    ).toEqual(1);
    expect(
      workspace.getTrieIdentifier().listByIdentifier('Note')[0].uri.path
    ).toEqual('/a/Note.md');

    expect(
      workspace.getTrieIdentifier().listByIdentifier('note').length
    ).toEqual(1);
    expect(
      workspace.getTrieIdentifier().listByIdentifier('note')[0].uri.path
    ).toEqual('/b/note.md');

    // Should not treat them as the same identifier
    expect(
      workspace.getTrieIdentifier().listByIdentifier('Note')[0]
    ).not.toEqual(workspace.getTrieIdentifier().listByIdentifier('note')[0]);
  });

  it('should generate correct identifiers for case-sensitive files', () => {
    const workspace = new FoamWorkspace('.md');
    const noteUppercase = createTestNote({ uri: '/a/Note.md' });
    const noteLowercase = createTestNote({ uri: '/b/note.md' });

    workspace.set(noteUppercase).set(noteLowercase);

    // Each should have a unique identifier without directory disambiguation
    // since they differ by case, they are not considered conflicting
    expect(
      workspace.getTrieIdentifier().getIdentifier(noteUppercase.uri)
    ).toEqual('Note');
    expect(
      workspace.getTrieIdentifier().getIdentifier(noteLowercase.uri)
    ).toEqual('note');
  });
});

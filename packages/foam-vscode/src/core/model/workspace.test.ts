import { FoamWorkspace } from './workspace';
import { Logger } from '../utils/log';
import { URI } from './uri';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';

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
    expect(ws.listByIdentifier('file').length).toEqual(1);
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
      expect(ws.listByIdentifier(reference)[0].uri.path).toEqual(path);
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
    const ws = new FoamWorkspace()
      .set(first)
      .set(second)
      .set(third);

    expect(ws.getIdentifier(first.uri)).toEqual('to/page-a');
    expect(ws.getIdentifier(second.uri)).toEqual('way/for/page-a');
    expect(ws.getIdentifier(third.uri)).toEqual('path/for/page-a');
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
    const ws = new FoamWorkspace()
      .set(first)
      .set(second)
      .set(third);

    expect(ws.getIdentifier(first.uri.withFragment('section name'))).toEqual(
      'to/page-a#section name'
    );
  });

  const needle = '/project/car/todo';

  test.each([
    [['/project/home/todo', '/other/todo', '/something/else'], 'car/todo'],
    [['/family/car/todo', '/other/todo'], 'project/car/todo'],
    [[], 'todo'],
  ])('should find shortest identifier', (haystack, id) => {
    expect(FoamWorkspace.getShortestIdentifier(needle, haystack)).toEqual(id);
  });

  it('should ignore same string in haystack', () => {
    const haystack = [
      needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];
    const identifier = FoamWorkspace.getShortestIdentifier(needle, haystack);
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
    const identifier = FoamWorkspace.getShortestIdentifier(needle, haystack);
    expect(identifier).toEqual('project/car/todo');
  });

  it('should ignore elements from the exclude list', () => {
    const workspace = new FoamWorkspace();
    const noteA = createTestNote({ uri: '/path/to/note-a.md' });
    const noteB = createTestNote({ uri: '/path/to/note-b.md' });
    const noteC = createTestNote({ uri: '/path/to/note-c.md' });
    const noteD = createTestNote({ uri: '/path/to/note-d.md' });
    const noteABis = createTestNote({ uri: '/path/to/another/note-a.md' });

    workspace
      .set(noteA)
      .set(noteB)
      .set(noteC)
      .set(noteD);
    expect(workspace.getIdentifier(noteABis.uri)).toEqual('another/note-a');
    expect(
      workspace.getIdentifier(noteABis.uri, [noteB.uri, noteA.uri])
    ).toEqual('note-a');
  });
});

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
    const ws = new FoamWorkspace([], '.md').set(first).set(second).set(third);

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
    const ws = new FoamWorkspace([], '.md').set(first).set(second).set(third);

    expect(
      ws.getIdentifier(first.uri.with({ fragment: 'section name' }))
    ).toEqual('to/page-a#section name');
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
    const workspace = new FoamWorkspace([], '.md');
    const noteA = createTestNote({ uri: '/path/to/note-a.md' });
    const noteB = createTestNote({ uri: '/path/to/note-b.md' });
    const noteC = createTestNote({ uri: '/path/to/note-c.md' });
    const noteD = createTestNote({ uri: '/path/to/note-d.md' });
    const noteABis = createTestNote({ uri: '/path/to/another/note-a.md' });

    workspace.set(noteA).set(noteB).set(noteC).set(noteD);
    expect(workspace.getIdentifier(noteABis.uri)).toEqual('another/note-a');
    expect(
      workspace.getIdentifier(noteABis.uri, [noteB.uri, noteA.uri])
    ).toEqual('note-a');
  });

  it('should handle case-sensitive filenames correctly (#1303)', () => {
    const workspace = new FoamWorkspace([], '.md');
    const noteUppercase = createTestNote({ uri: '/a/Note.md' });
    const noteLowercase = createTestNote({ uri: '/b/note.md' });

    workspace.set(noteUppercase).set(noteLowercase);

    // Should find exact case matches
    expect(workspace.listByIdentifier('Note').length).toEqual(1);
    expect(workspace.listByIdentifier('Note')[0].uri.path).toEqual(
      '/a/Note.md'
    );

    expect(workspace.listByIdentifier('note').length).toEqual(1);
    expect(workspace.listByIdentifier('note')[0].uri.path).toEqual(
      '/b/note.md'
    );

    // Should not treat them as the same identifier
    expect(workspace.listByIdentifier('Note')[0]).not.toEqual(
      workspace.listByIdentifier('note')[0]
    );
  });

  it('should generate correct identifiers for case-sensitive files', () => {
    const workspace = new FoamWorkspace([], '.md');
    const noteUppercase = createTestNote({ uri: '/a/Note.md' });
    const noteLowercase = createTestNote({ uri: '/b/note.md' });

    workspace.set(noteUppercase).set(noteLowercase);

    // Each should have a unique identifier without directory disambiguation
    // since they differ by case, they are not considered conflicting
    expect(workspace.getIdentifier(noteUppercase.uri)).toEqual('Note');
    expect(workspace.getIdentifier(noteLowercase.uri)).toEqual('note');
  });
});

describe('find in multi-root workspaces', () => {
  it('should find a resource that lives in root[1] when not found in root[0]', () => {
    const ws = new FoamWorkspace([
      URI.file('/workspace1'),
      URI.file('/workspace2'),
    ]);
    const note = createTestNote({ uri: '/workspace2/shared/file.md' });
    ws.set(note);

    const found = ws.find('/shared/file.md');
    expect(found).not.toBeNull();
    expect(found.uri.path).toBe('/workspace2/shared/file.md');
  });

  it('should find root[0] resource first when the same relative path exists in both roots', () => {
    const ws = new FoamWorkspace([
      URI.file('/workspace1'),
      URI.file('/workspace2'),
    ]);
    const noteA = createTestNote({ uri: '/workspace1/shared/file.md' });
    const noteB = createTestNote({ uri: '/workspace2/shared/file.md' });
    ws.set(noteA).set(noteB);

    const found = ws.find('/shared/file.md');
    expect(found).not.toBeNull();
    expect(found.uri.path).toBe('/workspace1/shared/file.md');
  });

  it('should find via workspace-relative path in a 3-root workspace when resource is in root[2]', () => {
    const ws = new FoamWorkspace([
      URI.file('/workspace1'),
      URI.file('/workspace2'),
      URI.file('/workspace3'),
    ]);
    const note = createTestNote({ uri: '/workspace3/notes/file.md' });
    ws.set(note);

    const found = ws.find('/notes/file.md');
    expect(found).not.toBeNull();
    expect(found.uri.path).toBe('/workspace3/notes/file.md');
  });
});

describe('resolveUri', () => {
  const root = URI.file('/workspace');

  it('should return an already-absolute path under the root as-is (case 1)', () => {
    const ws = new FoamWorkspace([root]);
    const result = ws.resolveUri('/workspace/journal/file.md');
    expect(result.path).toBe('/workspace/journal/file.md');
  });

  it('should resolve a workspace-relative absolute path under the root (case 2)', () => {
    const ws = new FoamWorkspace([root]);
    const result = ws.resolveUri('/journal/file.md');
    expect(result.path).toBe('/workspace/journal/file.md');
  });

  it('should resolve a relative path against roots[0] when no relativeTo is given (case 3)', () => {
    const ws = new FoamWorkspace([root]);
    const result = ws.resolveUri('journal/file.md');
    expect(result.path).toBe('/workspace/journal/file.md');
  });

  it('should resolve a relative path against relativeTo when provided (case 3)', () => {
    const ws = new FoamWorkspace([root]);
    const base = URI.file('/workspace/subdir/note.md');
    const result = ws.resolveUri('../other/file.md', base);
    expect(result.path).toBe('/workspace/other/file.md');
  });

  it('should return an absolute path as URI.file when roots is empty', () => {
    const ws = new FoamWorkspace([]);
    const result = ws.resolveUri('/some/absolute/file.md');
    expect(result.path).toBe('/some/absolute/file.md');
  });

  it('should handle the root path itself as under-root (case 1)', () => {
    const ws = new FoamWorkspace([root]);
    const result = ws.resolveUri('/workspace');
    expect(result.path).toBe('/workspace');
  });

  it('should use first root when multiple roots exist and path is workspace-relative (case 2)', () => {
    const root2 = URI.file('/other-root');
    const ws = new FoamWorkspace([root, root2]);
    const result = ws.resolveUri('/journal/file.md');
    expect(result.path).toBe('/workspace/journal/file.md');
  });

  it('should detect a path already under root[1] as under-root and return it as-is', () => {
    const root2 = URI.file('/workspace2');
    const ws = new FoamWorkspace([root, root2]);
    const result = ws.resolveUri('/workspace2/shared/file.md');
    // Must NOT become '/workspace/workspace2/shared/file.md'
    expect(result.path).toBe('/workspace2/shared/file.md');
  });

  describe('Windows drive paths', () => {
    it('should recognize a backslash drive path already under the root as-is (case 1)', () => {
      const winRoot = URI.file('C:\\workspace');
      const ws = new FoamWorkspace([winRoot]);
      // Raw backslash path: must be normalized before comparison, not doubled
      const result = ws.resolveUri('C:\\workspace\\journal\\file.md');
      expect(result.path).toBe('/C:/workspace/journal/file.md');
    });

    it('should not double a forward-slash drive path already under the root (case 1)', () => {
      const winRoot = URI.file('C:\\workspace');
      const ws = new FoamWorkspace([winRoot]);
      const result = ws.resolveUri('/C:/workspace/journal/file.md');
      expect(result.path).toBe('/C:/workspace/journal/file.md');
    });
  });
});

describe('find with workspace-relative absolute paths', () => {
  it('should find a resource stored at a real absolute path via a workspace-relative path', () => {
    const root = URI.file('/workspace');
    const ws = new FoamWorkspace([root]);
    const note = createTestNote({ uri: '/workspace/journal/file.md' });
    ws.set(note);

    // workspace-relative absolute path → should resolve to /workspace/journal/file.md
    const found = ws.find('/journal/file.md');
    expect(found).not.toBeNull();
    expect(found.uri.path).toBe('/workspace/journal/file.md');
  });

  it('should find with .md extension appended to workspace-relative path', () => {
    const root = URI.file('/workspace');
    const ws = new FoamWorkspace([root]);
    const note = createTestNote({ uri: '/workspace/journal/file.md' });
    ws.set(note);

    const found = ws.find('/journal/file');
    expect(found).not.toBeNull();
    expect(found.uri.path).toBe('/workspace/journal/file.md');
  });

  it('should still find an already-absolute filesystem path directly', () => {
    const root = URI.file('/workspace');
    const ws = new FoamWorkspace([root]);
    const note = createTestNote({ uri: '/workspace/journal/file.md' });
    ws.set(note);

    const found = ws.find('/workspace/journal/file.md');
    expect(found).not.toBeNull();
    expect(found.uri.path).toBe('/workspace/journal/file.md');
  });
});

describe('Directory index', () => {
  it('should resolve a directory to its index file', () => {
    const ws = createTestWorkspace();
    const index = createTestNote({ uri: '/foo/bar/index.md' });
    ws.set(index);
    expect(ws.findByDirectory('/foo/bar')).toEqual(index);
  });

  it('should resolve a directory to its README file', () => {
    const ws = createTestWorkspace();
    const readme = createTestNote({ uri: '/foo/bar/README.md' });
    ws.set(readme);
    expect(ws.findByDirectory('/foo/bar')).toEqual(readme);
  });

  it('should prefer index over README regardless of insertion order - index first', () => {
    const ws = createTestWorkspace();
    const index = createTestNote({ uri: '/foo/bar/index.md' });
    const readme = createTestNote({ uri: '/foo/bar/README.md' });
    ws.set(index).set(readme);
    expect(ws.findByDirectory('/foo/bar')).toEqual(index);
  });

  it('should prefer index over README regardless of insertion order - README first', () => {
    const ws = createTestWorkspace();
    const index = createTestNote({ uri: '/foo/bar/index.md' });
    const readme = createTestNote({ uri: '/foo/bar/README.md' });
    ws.set(readme).set(index);
    expect(ws.findByDirectory('/foo/bar')).toEqual(index);
  });

  it('should promote README when index is deleted', () => {
    const ws = createTestWorkspace();
    const index = createTestNote({ uri: '/foo/bar/index.md' });
    const readme = createTestNote({ uri: '/foo/bar/README.md' });
    ws.set(index).set(readme);
    expect(ws.findByDirectory('/foo/bar')).toEqual(index);
    ws.delete(index.uri);
    expect(ws.findByDirectory('/foo/bar')).toEqual(readme);
  });

  it('should return null when the only index file is deleted', () => {
    const ws = createTestWorkspace();
    const index = createTestNote({ uri: '/foo/bar/index.md' });
    ws.set(index);
    expect(ws.findByDirectory('/foo/bar')).toEqual(index);
    ws.delete(index.uri);
    expect(ws.findByDirectory('/foo/bar')).toBeNull();
  });

  it('should return null for a directory with no index files', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/foo/bar/page.md' }));
    expect(ws.findByDirectory('/foo/bar')).toBeNull();
  });

  it('should not treat regular files as index files', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/foo/bar/page.md' }));
    ws.set(createTestNote({ uri: '/foo/bar/notes.md' }));
    expect(ws.findByDirectory('/foo/bar')).toBeNull();
  });

  it('should track index files independently per directory', () => {
    const ws = createTestWorkspace();
    const indexA = createTestNote({ uri: '/foo/bar/index.md' });
    const indexB = createTestNote({ uri: '/foo/baz/index.md' });
    ws.set(indexA).set(indexB);
    expect(ws.findByDirectory('/foo/bar')).toEqual(indexA);
    expect(ws.findByDirectory('/foo/baz')).toEqual(indexB);
  });

  it('should clear directory index on workspace clear', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/foo/bar/index.md' }));
    ws.clear();
    expect(ws.findByDirectory('/foo/bar')).toBeNull();
  });

  describe('getDirectoryIdentifier', () => {
    it('should return null for a non-index file', () => {
      const ws = createTestWorkspace();
      const note = createTestNote({ uri: '/foo/bar/page.md' });
      ws.set(note);
      expect(ws.getDirectoryIdentifier(note.uri)).toBeNull();
    });

    it('should return the directory name when unambiguous', () => {
      const ws = createTestWorkspace();
      const index = createTestNote({ uri: '/foo/bar/index.md' });
      ws.set(index);
      expect(ws.getDirectoryIdentifier(index.uri)).toBe('bar');
    });

    it('should return a more specific path when directory name is ambiguous', () => {
      const ws = createTestWorkspace();
      const fooIndex = createTestNote({ uri: '/foo/bar/index.md' });
      const zooIndex = createTestNote({ uri: '/zoo/bar/index.md' });
      ws.set(fooIndex).set(zooIndex);
      expect(ws.getDirectoryIdentifier(fooIndex.uri)).toBe('foo/bar');
      expect(ws.getDirectoryIdentifier(zooIndex.uri)).toBe('zoo/bar');
    });

    it('should return null for a README.md when index.md owns the directory', () => {
      const ws = createTestWorkspace();
      const index = createTestNote({ uri: '/foo/bar/index.md' });
      const readme = createTestNote({ uri: '/foo/bar/README.md' });
      ws.set(index).set(readme);
      expect(ws.getDirectoryIdentifier(readme.uri)).toBeNull();
      expect(ws.getDirectoryIdentifier(index.uri)).toBe('bar');
    });
  });
});

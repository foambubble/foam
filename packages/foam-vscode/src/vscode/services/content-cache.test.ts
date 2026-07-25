import { URI } from '@foam/core';
import {
  createTestWorkspace,
  createNoteFromMarkdown,
  InMemoryDataStore,
} from '../../test/test-utils';
import { ContentCache, getContentCacheFor } from './content-cache';

class CountingDataStore extends InMemoryDataStore {
  public readCount = 0;

  async read(uri: URI): Promise<string | null> {
    this.readCount++;
    return super.read(uri);
  }
}

const createWorkspaceWithNote = (content = 'line one\nline two') => {
  const dataStore = new CountingDataStore();
  const workspace = createTestWorkspace([URI.file('/')], dataStore);
  const note = createNoteFromMarkdown('/note-a.md', content);
  dataStore.set(note.uri, content);
  workspace.set(note);
  return { dataStore, workspace, note };
};

describe('ContentCache', () => {
  it('returns the content of the resource', async () => {
    const { workspace, note } = createWorkspaceWithNote('line one\nline two');
    const cache = new ContentCache(workspace);

    const content = await cache.readAsMarkdown(note.uri);

    expect(content).toEqual('line one\nline two');
  });

  it('returns the lines of the resource', async () => {
    const { workspace, note } = createWorkspaceWithNote('line one\nline two');
    const cache = new ContentCache(workspace);

    const lines = await cache.readLines(note.uri);

    expect(lines).toEqual(['line one', 'line two']);
  });

  it('splits the content into lines only once per cached entry', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);

    const first = await cache.readLines(note.uri);
    const second = await cache.readLines(note.uri);

    // same array instance: the split is memoized alongside the content
    expect(second).toBe(first);
    expect(dataStore.readCount).toEqual(1);
  });

  it('recomputes the lines after the resource is updated', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);
    await cache.readLines(note.uri);

    const updatedContent = 'updated content';
    dataStore.set(note.uri, updatedContent);
    workspace.set(createNoteFromMarkdown('/note-a.md', updatedContent));

    const lines = await cache.readLines(note.uri);

    expect(lines).toEqual(['updated content']);
  });

  it('only reads from the workspace once for repeated reads', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);

    await cache.readAsMarkdown(note.uri);
    await cache.readAsMarkdown(note.uri);
    await cache.readAsMarkdown(note.uri);

    expect(dataStore.readCount).toEqual(1);
  });

  it('shares a single read across concurrent requests', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);

    const [first, second] = await Promise.all([
      cache.readAsMarkdown(note.uri),
      cache.readAsMarkdown(note.uri),
    ]);

    expect(dataStore.readCount).toEqual(1);
    expect(first).toEqual(second);
  });

  it('reads again after the resource is updated in the workspace', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);
    await cache.readAsMarkdown(note.uri);

    const updatedContent = 'updated content';
    dataStore.set(note.uri, updatedContent);
    workspace.set(createNoteFromMarkdown('/note-a.md', updatedContent));

    const content = await cache.readAsMarkdown(note.uri);

    expect(dataStore.readCount).toEqual(2);
    expect(content).toEqual(updatedContent);
  });

  it('reads again after the resource is deleted from the workspace', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);
    await cache.readAsMarkdown(note.uri);

    workspace.delete(note.uri);

    await cache.readAsMarkdown(note.uri);

    expect(dataStore.readCount).toEqual(2);
  });

  it('does not cache the result of a read that resolves after an invalidation', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);

    const pendingRead = cache.readAsMarkdown(note.uri);
    // the file changes while the read is in flight: its result may be stale
    workspace.set(createNoteFromMarkdown('/note-a.md', 'updated content'));
    await pendingRead;

    await cache.readAsMarkdown(note.uri);

    expect(dataStore.readCount).toEqual(2);
  });

  it('does not cache fragment URIs, whose content is section-specific', async () => {
    const content = '# Section One\ntext\n# Section Two\nmore text';
    const { dataStore, workspace, note } = createWorkspaceWithNote(content);
    const cache = new ContentCache(workspace);
    const fragmentUri = note.uri.with({ fragment: 'Section One' });

    const value = await cache.readAsMarkdown(fragmentUri);
    await cache.readAsMarkdown(fragmentUri);

    expect(value).toContain('Section One');
    expect(value).not.toContain('Section Two');
    expect(dataStore.readCount).toEqual(2);
  });

  it('does not cache failed reads', async () => {
    const { dataStore, workspace } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);
    const missing = URI.file('/does-not-exist.md');

    expect(await cache.readAsMarkdown(missing)).toEqual(null);
    expect(await cache.readAsMarkdown(missing)).toEqual(null);

    expect(dataStore.readCount).toEqual(2);
  });

  it('evicts the least recently used entries when over the size budget', async () => {
    const dataStore = new CountingDataStore();
    const workspace = createTestWorkspace([URI.file('/')], dataStore);
    const contentA = 'a'.repeat(80);
    const contentB = 'b'.repeat(80);
    const noteA = createNoteFromMarkdown('/note-a.md', contentA);
    const noteB = createNoteFromMarkdown('/note-b.md', contentB);
    dataStore.set(noteA.uri, contentA);
    dataStore.set(noteB.uri, contentB);
    workspace.set(noteA);
    workspace.set(noteB);
    // budget only fits one of the two notes
    const cache = new ContentCache(workspace, { maxSizeInChars: 100 });

    await cache.readAsMarkdown(noteA.uri);
    await cache.readAsMarkdown(noteB.uri); // evicts note A
    await cache.readAsMarkdown(noteA.uri); // must read again

    expect(dataStore.readCount).toEqual(3);
  });

  it('stops invalidating once disposed', async () => {
    const { dataStore, workspace, note } = createWorkspaceWithNote();
    const cache = new ContentCache(workspace);
    await cache.readAsMarkdown(note.uri);

    cache.dispose();

    // must not throw on workspace events after disposal
    workspace.set(createNoteFromMarkdown('/note-a.md', 'updated content'));
    expect(dataStore.readCount).toEqual(1);
  });
});

describe('getContentCacheFor', () => {
  it('returns the same cache for the same workspace', () => {
    const { workspace } = createWorkspaceWithNote();
    expect(getContentCacheFor(workspace)).toBe(getContentCacheFor(workspace));
  });

  it('returns different caches for different workspaces', () => {
    const first = createWorkspaceWithNote();
    const second = createWorkspaceWithNote();
    expect(getContentCacheFor(first.workspace)).not.toBe(
      getContentCacheFor(second.workspace)
    );
  });
});

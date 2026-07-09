/* @unit-ready */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionContext, Uri } from 'vscode';
import { URI, ParserCacheEntry } from '@foam/core';
import { createTestNote, randomString } from '../../test/test-utils';
import { MapBasedMemento } from '../utils/vsc-utils';
import VsCodeBasedParserCache from './cache';

describe('VsCodeBasedParserCache', () => {
  const createContext = (storageDir?: string): ExtensionContext => {
    return {
      workspaceState: new MapBasedMemento(),
      storageUri: storageDir ? Uri.file(storageDir) : undefined,
    } as unknown as ExtensionContext;
  };

  const createTmpStorageDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'foam-cache-spec-'));

  const createEntry = (name: string): { uri: URI; entry: ParserCacheEntry } => {
    const resource = createTestNote({ uri: `/notes/${name}.md` });
    return {
      uri: resource.uri,
      entry: { checksum: randomString(), resource },
    };
  };

  const bucketDirOf = (storageDir: string) =>
    path.join(storageDir, VsCodeBasedParserCache.CACHE_DIR_NAME);

  const snapshotBucketFiles = (storageDir: string): Map<string, string> => {
    const dir = bucketDirOf(storageDir);
    const snapshot = new Map<string, string>();
    for (const file of fs.readdirSync(dir)) {
      snapshot.set(file, fs.readFileSync(path.join(dir, file), 'utf8'));
    }
    return snapshot;
  };

  it('starts empty when no persisted cache exists', async () => {
    const storageDir = createTmpStorageDir();
    const cache = await VsCodeBasedParserCache.create(createContext(storageDir));
    const { uri } = createEntry('some-note');
    expect(cache.has(uri)).toBe(false);
    expect(cache.get(uri)).toBeUndefined();
  });

  it('returns entries with a rehydrated URI instance', async () => {
    const storageDir = createTmpStorageDir();
    const cache = await VsCodeBasedParserCache.create(createContext(storageDir));
    const { uri, entry } = createEntry('a-note');
    cache.set(uri, entry);
    const result = cache.get(uri);
    expect(result.checksum).toEqual(entry.checksum);
    expect(result.resource.uri).toBeInstanceOf(URI);
    expect(result.resource.uri.isEqual(uri)).toBe(true);
  });

  it('persists entries across instances', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const { uri, entry } = createEntry('a-note');
    cache.set(uri, entry);
    await cache.flush();

    const reloaded = await VsCodeBasedParserCache.create(context);
    expect(reloaded.has(uri)).toBe(true);
    expect(reloaded.get(uri).checksum).toEqual(entry.checksum);
    expect(reloaded.get(uri).resource.title).toEqual(entry.resource.title);
  });

  it('removes deleted entries from the persisted cache', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const first = createEntry('first');
    const second = createEntry('second');
    cache.set(first.uri, first.entry);
    cache.set(second.uri, second.entry);
    await cache.flush();

    cache.del(first.uri);
    await cache.flush();

    const reloaded = await VsCodeBasedParserCache.create(context);
    expect(reloaded.has(first.uri)).toBe(false);
    expect(reloaded.has(second.uri)).toBe(true);
  });

  it('only rewrites the bucket files affected by a change', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const notes = [...Array(50).keys()].map(i => createEntry(`note-${i}`));
    for (const { uri, entry } of notes) {
      cache.set(uri, entry);
    }
    await cache.flush();

    const before = snapshotBucketFiles(storageDir);
    // 50 keys over 64 buckets: more than one bucket file must exist,
    // otherwise this test would pass vacuously
    expect(before.size).toBeGreaterThan(1);

    cache.set(notes[0].uri, {
      ...notes[0].entry,
      checksum: 'updated-checksum',
    });
    await cache.flush();

    const after = snapshotBucketFiles(storageDir);
    const changed = [...after.keys()].filter(file => before.get(file) !== after.get(file));
    expect(changed.length).toEqual(1);
  });

  it('clears both the in-memory and the persisted cache', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const { uri, entry } = createEntry('a-note');
    cache.set(uri, entry);
    await cache.flush();

    await cache.clear();
    expect(cache.has(uri)).toBe(false);
    expect(fs.existsSync(bucketDirOf(storageDir))).toBe(false);

    const reloaded = await VsCodeBasedParserCache.create(context);
    expect(reloaded.has(uri)).toBe(false);
  });

  it('is not resurrected by a pending sync scheduled before clear()', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const { uri, entry } = createEntry('a-note');
    // set() schedules a debounced sync; clear() before it fires must win
    cache.set(uri, entry);
    await cache.clear();
    await cache.flush();

    const reloaded = await VsCodeBasedParserCache.create(context);
    expect(reloaded.has(uri)).toBe(false);
    expect(fs.existsSync(bucketDirOf(storageDir))).toBe(false);
  });

  it('recovers from a corrupted bucket file, keeping the other buckets', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const notes = [...Array(50).keys()].map(i => createEntry(`note-${i}`));
    for (const { uri, entry } of notes) {
      cache.set(uri, entry);
    }
    await cache.flush();

    const bucketFiles = fs.readdirSync(bucketDirOf(storageDir));
    expect(bucketFiles.length).toBeGreaterThan(1);
    const corrupted = path.join(bucketDirOf(storageDir), bucketFiles[0]);
    fs.writeFileSync(corrupted, 'not valid json {');

    const reloaded = await VsCodeBasedParserCache.create(context);
    const loadedCount = notes.filter(({ uri }) => reloaded.has(uri)).length;
    expect(loadedCount).toBeGreaterThan(0);
    expect(loadedCount).toBeLessThan(notes.length);
    // the corrupted bucket is discarded so it doesn't fail every startup
    expect(fs.existsSync(corrupted)).toBe(false);
  });

  it('migrates the legacy workspaceState cache and removes the old key', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);
    const { uri, entry } = createEntry('legacy-note');
    await context.workspaceState.update(
      VsCodeBasedParserCache.CACHE_VERSION_KEY,
      VsCodeBasedParserCache.CACHE_VERSION
    );
    await context.workspaceState.update(VsCodeBasedParserCache.LEGACY_STATE_KEY, [
      [uri.toString(), { value: entry }],
    ]);

    const cache = await VsCodeBasedParserCache.create(context);
    expect(cache.has(uri)).toBe(true);
    expect(cache.get(uri).checksum).toEqual(entry.checksum);
    expect(context.workspaceState.get(VsCodeBasedParserCache.LEGACY_STATE_KEY)).toBeUndefined();

    // the migrated entries are re-persisted in the sharded layout
    await cache.flush();
    const reloaded = await VsCodeBasedParserCache.create(context);
    expect(reloaded.has(uri)).toBe(true);
  });

  it('discards the persisted cache when the version changes', async () => {
    const storageDir = createTmpStorageDir();
    const context = createContext(storageDir);

    const cache = await VsCodeBasedParserCache.create(context);
    const { uri, entry } = createEntry('a-note');
    cache.set(uri, entry);
    await cache.flush();

    await context.workspaceState.update(
      VsCodeBasedParserCache.CACHE_VERSION_KEY,
      VsCodeBasedParserCache.CACHE_VERSION - 1
    );

    const reloaded = await VsCodeBasedParserCache.create(context);
    expect(reloaded.has(uri)).toBe(false);
    expect(context.workspaceState.get(VsCodeBasedParserCache.CACHE_VERSION_KEY)).toEqual(
      VsCodeBasedParserCache.CACHE_VERSION
    );
  });

  it('operates in-memory when no storage is available', async () => {
    const cache = await VsCodeBasedParserCache.create(createContext());
    const { uri, entry } = createEntry('a-note');
    cache.set(uri, entry);
    expect(cache.has(uri)).toBe(true);
    await cache.flush();
    cache.del(uri);
    expect(cache.has(uri)).toBe(false);
    await cache.clear();
  });
});

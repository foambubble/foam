/* @unit-ready */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionContext, Uri } from 'vscode';
import { URI, ParserCacheEntry } from '@foam/core';
import { createTestNote, randomString } from '../../test/test-utils';
import { MapBasedMemento } from '../utils/vsc-utils';
import VsCodeBasedParserCache from './cache';

const createContext = (storageDir?: string): ExtensionContext => {
  return {
    workspaceState: new MapBasedMemento(),
    storageUri: storageDir ? Uri.file(storageDir) : undefined,
  } as unknown as ExtensionContext;
};

const createTmpStorageDir = (prefix = 'foam-cache-spec-') => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    rootDir,
    cleanup: () => fs.rmSync(rootDir, { recursive: true, force: true }),
  };
};

const withTmpStorageDir = async (fn: (storageDir: string) => Promise<void>) => {
  const { rootDir, cleanup } = createTmpStorageDir();
  try {
    await fn(rootDir);
  } finally {
    cleanup();
  }
};

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

const countPersistedEntries = (storageDir: string): number => {
  let count = 0;
  for (const content of snapshotBucketFiles(storageDir).values()) {
    count += JSON.parse(content).length;
  }
  return count;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('VsCodeBasedParserCache', () => {
  it('starts empty when no persisted cache exists', async () => {
    await withTmpStorageDir(async storageDir => {
      const cache = await VsCodeBasedParserCache.create(
        createContext(storageDir)
      );
      const { uri } = createEntry('some-note');
      expect(cache.has(uri)).toBe(false);
      expect(cache.get(uri)).toBeUndefined();
    });
  });

  it('returns entries with a rehydrated URI instance', async () => {
    await withTmpStorageDir(async storageDir => {
      const cache = await VsCodeBasedParserCache.create(
        createContext(storageDir)
      );
      const { uri, entry } = createEntry('a-note');
      cache.set(uri, entry);
      const result = cache.get(uri);
      expect(result.checksum).toEqual(entry.checksum);
      expect(result.resource.uri).toBeInstanceOf(URI);
      expect(result.resource.uri.isEqual(uri)).toBe(true);
    });
  });

  it('persists entries across instances', async () => {
    await withTmpStorageDir(async storageDir => {
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
  });

  it('removes deleted entries from the persisted cache', async () => {
    await withTmpStorageDir(async storageDir => {
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
  });

  it('only rewrites the bucket files affected by a change', async () => {
    await withTmpStorageDir(async storageDir => {
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
      const changed = [...after.keys()].filter(
        file => before.get(file) !== after.get(file)
      );
      expect(changed.length).toEqual(1);
    });
  });

  it('clears both the in-memory and the persisted cache', async () => {
    await withTmpStorageDir(async storageDir => {
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
  });

  it('is not resurrected by a pending sync scheduled before clear()', async () => {
    await withTmpStorageDir(async storageDir => {
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
  });

  it('recovers from a corrupted bucket file, keeping the other buckets', async () => {
    await withTmpStorageDir(async storageDir => {
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
  });

  it('migrates the legacy workspaceState cache and removes the old key', async () => {
    await withTmpStorageDir(async storageDir => {
      const context = createContext(storageDir);
      const { uri, entry } = createEntry('legacy-note');
      await context.workspaceState.update(
        VsCodeBasedParserCache.CACHE_VERSION_KEY,
        VsCodeBasedParserCache.CACHE_VERSION
      );
      await context.workspaceState.update(
        VsCodeBasedParserCache.LEGACY_STATE_KEY,
        [[uri.toString(), { value: entry }]]
      );

      const cache = await VsCodeBasedParserCache.create(context);
      expect(cache.has(uri)).toBe(true);
      expect(cache.get(uri).checksum).toEqual(entry.checksum);
      expect(
        context.workspaceState.get(VsCodeBasedParserCache.LEGACY_STATE_KEY)
      ).toBeUndefined();

      // the migrated entries are re-persisted in the sharded layout
      await cache.flush();
      const reloaded = await VsCodeBasedParserCache.create(context);
      expect(reloaded.has(uri)).toBe(true);
    });
  });

  it('persists migrated legacy entries before removing the old key', async () => {
    await withTmpStorageDir(async storageDir => {
      const context = createContext(storageDir);
      const { uri, entry } = createEntry('legacy-note');
      await context.workspaceState.update(
        VsCodeBasedParserCache.CACHE_VERSION_KEY,
        VsCodeBasedParserCache.CACHE_VERSION
      );
      await context.workspaceState.update(
        VsCodeBasedParserCache.LEGACY_STATE_KEY,
        [[uri.toString(), { value: entry }]]
      );

      await VsCodeBasedParserCache.create(context);

      // the sharded files must exist as soon as create() resolves: the legacy
      // blob is already gone, so a crash before a later debounced sync would
      // otherwise lose the whole cache
      expect(fs.existsSync(bucketDirOf(storageDir))).toBe(true);
      const reloaded = await VsCodeBasedParserCache.create(context);
      expect(reloaded.has(uri)).toBe(true);
    });
  });

  it('does not stamp the new cache version if clearing the old cache fails', async () => {
    await withTmpStorageDir(async storageDir => {
      const context = createContext(storageDir);

      const cache = await VsCodeBasedParserCache.create(context);
      const { uri, entry } = createEntry('a-note');
      cache.set(uri, entry);
      await cache.flush();

      await context.workspaceState.update(
        VsCodeBasedParserCache.CACHE_VERSION_KEY,
        VsCodeBasedParserCache.CACHE_VERSION - 1
      );

      // make the bucket files undeletable, so the version-mismatch clear fails
      fs.chmodSync(bucketDirOf(storageDir), 0o555);
      try {
        await VsCodeBasedParserCache.create(context);
        // the version must not be stamped, so the clear is retried next startup
        expect(
          context.workspaceState.get(VsCodeBasedParserCache.CACHE_VERSION_KEY)
        ).toEqual(VsCodeBasedParserCache.CACHE_VERSION - 1);
      } finally {
        fs.chmodSync(bucketDirOf(storageDir), 0o755);
      }

      // once deleting works again, the stale entries are gone for good
      const recovered = await VsCodeBasedParserCache.create(context);
      expect(recovered.has(uri)).toBe(false);
      expect(
        context.workspaceState.get(VsCodeBasedParserCache.CACHE_VERSION_KEY)
      ).toEqual(VsCodeBasedParserCache.CACHE_VERSION);
    });
  });

  it('retries a failed write on the next flush, without background retries', async () => {
    await withTmpStorageDir(async storageDir => {
      const context = createContext(storageDir);

      const cache = await VsCodeBasedParserCache.create(context);
      const { uri, entry } = createEntry('a-note');
      cache.set(uri, entry);
      await cache.flush();

      const bucketDir = bucketDirOf(storageDir);
      const [bucketFile] = fs.readdirSync(bucketDir);
      const bucketPath = path.join(bucketDir, bucketFile);
      const staleContent = fs.readFileSync(bucketPath, 'utf8');

      // make the write fail
      fs.chmodSync(bucketPath, 0o444);
      fs.chmodSync(bucketDir, 0o555);
      cache.set(uri, { ...entry, checksum: 'updated-checksum' });
      await cache.flush();
      fs.chmodSync(bucketDir, 0o755);
      fs.chmodSync(bucketPath, 0o644);

      // no self-rescheduled retry may fire in the background...
      await sleep(1500);
      expect(fs.readFileSync(bucketPath, 'utf8')).toEqual(staleContent);

      // ...but the change is still pending and lands on the next flush
      await cache.flush();
      expect(fs.readFileSync(bucketPath, 'utf8')).not.toEqual(staleContent);
      const reloaded = await VsCodeBasedParserCache.create(context);
      expect(reloaded.get(uri).checksum).toEqual('updated-checksum');
    });
  });

  it('flush() persists buckets that only became dirty through eviction', async () => {
    await withTmpStorageDir(async storageDir => {
      const context = createContext(storageDir);

      const cache = await VsCodeBasedParserCache.create(context, 10);
      const notes = [...Array(10).keys()].map(i => createEntry(`note-${i}`));
      for (const { uri, entry } of notes) {
        cache.set(uri, entry);
      }
      await cache.flush();
      expect(countPersistedEntries(storageDir)).toEqual(10);

      // reloading with a smaller capacity evicts the overflow; the evictions
      // mark buckets dirty without going through set()/del()
      const reloaded = await VsCodeBasedParserCache.create(context, 5);
      await reloaded.flush();
      expect(countPersistedEntries(storageDir)).toEqual(5);
    });
  });

  it('discards the persisted cache when the version changes', async () => {
    await withTmpStorageDir(async storageDir => {
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
      expect(
        context.workspaceState.get(VsCodeBasedParserCache.CACHE_VERSION_KEY)
      ).toEqual(VsCodeBasedParserCache.CACHE_VERSION);
    });
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

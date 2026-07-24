import { debounce } from 'lodash';
import { LRUCache } from 'lru-cache';
import { ExtensionContext } from 'vscode';
import { URI } from '@foam/core';
import { ParserCache, ParserCacheEntry } from '@foam/core';
import { Resource, ResourceJson } from '@foam/core';
import { Logger } from '@foam/core';
import { deleteFile, dirExists, readFile, writeFile } from './editor';
import { fromVsCodeUri } from '../utils/vsc-utils';

/**
 * This is a best effort implementation to cache resources.
 * It's not a perfect solution, but it's a good start.
 *
 * We use the URI and a checksum of the markdown file to cache the resource.
 *
 * Entries live in an in-memory LRU cache; persistence shards them across a
 * fixed number of bucket files under the extension storage area:
 *
 *   <storageUri>/parser-cache/bucket-00.json ... bucket-3f.json
 *
 * A resource always maps to the same bucket (hash of its URI), and only
 * buckets touched since the last sync are rewritten, so the cost of
 * persisting is proportional to what changed, not to the workspace size.
 * A corrupted bucket file only invalidates the notes in that bucket, which
 * are transparently re-parsed.
 *
 * Global LRU recency is not preserved across restarts (entries are
 * re-inserted bucket by bucket); eviction order self-corrects as entries
 * are accessed.
 *
 * Bump CACHE_VERSION whenever the cached Resource schema changes (e.g. new
 * fields added to Block, ResourceLink, etc.) so stale persisted entries are
 * discarded automatically on the next startup.
 */
export default class VsCodeBasedParserCache implements ParserCache {
  static CACHE_VERSION = 5;
  static CACHE_VERSION_KEY = 'foam-cache-version';
  static CACHE_DIR_NAME = 'parser-cache';
  static BUCKET_COUNT = 64;
  /** workspaceState key used by earlier versions, migrated on load */
  static LEGACY_STATE_KEY = 'foam-cache';

  private _cache: LRUCache<string, ParserCacheEntry>;
  private _cacheDir: URI | undefined;
  private _dirty = new Set<number>();
  private _pendingWrite: Promise<void> = Promise.resolve();

  private constructor(private context: ExtensionContext, size: number) {
    this._cacheDir = context.storageUri
      ? fromVsCodeUri(context.storageUri).joinPath(
          VsCodeBasedParserCache.CACHE_DIR_NAME
        )
      : undefined;
    this._cache = new LRUCache({
      max: size,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      // set()/del() mark their bucket dirty themselves; eviction is the
      // only other way an entry leaves the cache and must be persisted
      dispose: (_entry, key, reason) => {
        if (reason === 'evict') {
          this._dirty.add(bucketOf(key));
        }
      },
    });
  }

  static async create(
    context: ExtensionContext,
    size = 10000
  ): Promise<VsCodeBasedParserCache> {
    const instance = new VsCodeBasedParserCache(context, size);
    await instance.load();
    return instance;
  }

  private async load(): Promise<void> {
    const storedVersion = this.context.workspaceState.get<number>(
      VsCodeBasedParserCache.CACHE_VERSION_KEY,
      0
    );
    if (storedVersion !== VsCodeBasedParserCache.CACHE_VERSION) {
      Logger.debug(
        `Cache version mismatch (stored: ${storedVersion}, current: ${VsCodeBasedParserCache.CACHE_VERSION}) — clearing cache`
      );
      await this.clear();
      if (this._cacheDir && (await dirExists(this._cacheDir))) {
        // deleting the outdated files failed: don't stamp the new version,
        // or the stale entries would be loaded as current data next startup
        Logger.warn(
          'Could not remove the outdated parser cache — will retry on next startup'
        );
        return;
      }
      await this.context.workspaceState.update(
        VsCodeBasedParserCache.CACHE_VERSION_KEY,
        VsCodeBasedParserCache.CACHE_VERSION
      );
      return;
    }

    const imported = await this.importLegacyWorkspaceState();
    if (!imported) {
      await this.loadBuckets();
    }
    Logger.debug('Cache size: ' + this._cache.size);
  }

  /**
   * Imports the cache blob that earlier versions kept in workspaceState,
   * re-shards it to bucket files, and removes the old key — keeping the
   * blob would defeat the purpose of file-based storage, as it gets
   * serialized with the rest of the workspace state (see #1677).
   * Returns whether any entries were imported.
   */
  private async importLegacyWorkspaceState(): Promise<boolean> {
    const source = this.context.workspaceState.get<any[]>(
      VsCodeBasedParserCache.LEGACY_STATE_KEY
    );
    if (source === undefined) {
      return false;
    }
    let imported = false;
    if (Array.isArray(source) && source.length > 0) {
      try {
        this._cache.load(source);
        for (const key of this._cache.keys()) {
          this._dirty.add(bucketOf(key));
        }
        // persist the re-sharded entries before the legacy blob is removed
        // below, so a crash in between cannot lose the whole cache
        await this.performSync();
        imported = true;
        Logger.info(
          `Migrated parser cache from workspace state (${this._cache.size} entries)`
        );
      } catch (e) {
        Logger.warn(
          `Failed to migrate parser cache from workspace state: ${e}`
        );
      }
    }
    await this.context.workspaceState.update(
      VsCodeBasedParserCache.LEGACY_STATE_KEY,
      undefined
    );
    return imported;
  }

  private bucketUri(index: number): URI {
    return this._cacheDir.joinPath(
      `bucket-${index.toString(16).padStart(2, '0')}.json`
    );
  }

  private async loadBuckets(): Promise<void> {
    if (!this._cacheDir) {
      return;
    }
    await Promise.all(
      [...Array(VsCodeBasedParserCache.BUCKET_COUNT).keys()].map(index =>
        this.loadBucket(index)
      )
    );
  }

  private async loadBucket(index: number): Promise<void> {
    const uri = this.bucketUri(index);
    try {
      const content = await readFile(uri);
      if (content === undefined) {
        return;
      }
      const entries: [string, ParserCacheEntry][] = JSON.parse(content);
      for (const [key, entry] of entries) {
        this._cache.set(key, entry);
      }
    } catch (e) {
      // a corrupted bucket only costs re-parsing its own notes
      Logger.warn(`Failed to load cache bucket ${uri.toFsPath()}: ${e}`);
      await deleteQuietly(uri);
    }
  }

  async clear(): Promise<void> {
    this.scheduleSync.cancel();
    this._cache.clear();
    this._dirty.clear();
    // let any in-flight write settle, so it cannot recreate files afterwards
    await this._pendingWrite;
    if (this._cacheDir) {
      await deleteQuietly(this._cacheDir);
    }
    await this.context.workspaceState.update(
      VsCodeBasedParserCache.LEGACY_STATE_KEY,
      undefined
    );
  }

  get(uri: URI): ParserCacheEntry {
    const result = this._cache.get(uri.toString());
    if (result) {
      return {
        checksum: result.checksum,
        resource: Resource.fromJSON(result.resource as ResourceJson),
      };
    }
    return undefined;
  }

  has(uri: URI): boolean {
    return this._cache.has(uri.toString());
  }

  set(uri: URI, entry: ParserCacheEntry): void {
    const key = uri.toString();
    this._cache.set(key, entry);
    this._dirty.add(bucketOf(key));
    this.scheduleSync();
  }

  del(uri: URI): void {
    const key = uri.toString();
    this._cache.delete(key);
    this._dirty.add(bucketOf(key));
    this.scheduleSync();
  }

  /**
   * Persists any pending change immediately, bypassing the debounce.
   */
  async flush(): Promise<void> {
    // sync directly instead of flushing the debounce: buckets dirtied by
    // eviction (or by a failed write) have no scheduled sync to flush
    this.scheduleSync.cancel();
    await this.performSync();
  }

  /**
   * Register the cache in `context.subscriptions` so the latest parse
   * results are persisted on shutdown (best effort).
   */
  dispose(): void {
    this.flush();
  }

  private scheduleSync = debounce(() => {
    this.performSync();
  }, 1000);

  private performSync(): Promise<void> {
    // writes are chained so two syncs can never interleave
    this._pendingWrite = this._pendingWrite.then(() =>
      this.writeDirtyBuckets()
    );
    return this._pendingWrite;
  }

  private async writeDirtyBuckets(): Promise<void> {
    if (!this._cacheDir || this._dirty.size === 0) {
      return;
    }
    const buckets = new Map<number, [string, ParserCacheEntry][]>();
    for (const index of this._dirty) {
      buckets.set(index, []);
    }
    this._dirty = new Set();
    // single pass over the keys; only entries of dirty buckets are serialized
    for (const [key, entry] of this._cache.entries()) {
      buckets.get(bucketOf(key))?.push([key, entry]);
    }
    Logger.debug(`Updating parser cache (${buckets.size} buckets)`);
    await Promise.all(
      [...buckets].map(async ([index, entries]) => {
        try {
          if (entries.length === 0) {
            await deleteQuietly(this.bucketUri(index));
          } else {
            await writeFile(this.bucketUri(index), JSON.stringify(entries));
          }
        } catch (e) {
          // the bucket stays dirty and is retried on the next sync or flush;
          // rescheduling here would retry a persistent failure forever
          Logger.warn(`Failed to write cache bucket ${index}: ${e}`);
          this._dirty.add(index);
        }
      })
    );
  }
}

async function deleteQuietly(uri: URI): Promise<void> {
  try {
    await deleteFile(uri);
  } catch {
    // the file may not exist — deleting is best effort
  }
}

/**
 * FNV-1a — stable across sessions, so a URI always lands in the same bucket
 */
function bucketOf(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % VsCodeBasedParserCache.BUCKET_COUNT;
}

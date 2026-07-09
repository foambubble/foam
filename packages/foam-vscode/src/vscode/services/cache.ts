import { debounce } from 'lodash';
import { LRUCache } from 'lru-cache';
import { ExtensionContext, workspace, Uri } from 'vscode';
import { URI } from '@foam/core';
import {
  ParserCache,
  ParserCacheEntry,
} from '@foam/core';
import { Logger } from '@foam/core';

/**
 * This is a best effort implementation to cache resources.
 * It's not a perfect solution, but it's a good start.
 *
 * We use the URI and a checksum of the markdown file to cache the resource.
 *
 * Bump CACHE_VERSION whenever the cached Resource schema changes (e.g. new
 * fields added to Block, ResourceLink, etc.) so stale persisted entries are
 * discarded automatically on the next startup.
 */
export default class VsCodeBasedParserCache implements ParserCache {
  static CACHE_FILENAME = 'parser-cache.json';
  static CACHE_VERSION = 5;
  static CACHE_VERSION_KEY = 'foam-cache-version';
  private _cache: LRUCache<string, ParserCacheEntry>;
  private _syncing = false;
  private _needsSync = false;

  private constructor(private context: ExtensionContext, size = 10000) {
    this._cache = new LRUCache({
      max: size,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  static async create(context: ExtensionContext, size = 10000): Promise<VsCodeBasedParserCache> {
    const instance = new VsCodeBasedParserCache(context, size);
    await instance.load();
    return instance;
  }

  private getCacheUri(): Uri | undefined {
    if (!this.context.storageUri) {
      return undefined;
    }
    return Uri.joinPath(this.context.storageUri, VsCodeBasedParserCache.CACHE_FILENAME);
  }

  private async load() {
    const storedVersion = this.context.workspaceState.get<number>(
      VsCodeBasedParserCache.CACHE_VERSION_KEY,
      0
    );

    const cacheUri = this.getCacheUri();

    if (storedVersion !== VsCodeBasedParserCache.CACHE_VERSION) {
      Logger.debug(
        `Cache version mismatch (stored: ${storedVersion}, current: ${VsCodeBasedParserCache.CACHE_VERSION}) — clearing cache`
      );
      await this.clear();
      this.context.workspaceState.update(
        VsCodeBasedParserCache.CACHE_VERSION_KEY,
        VsCodeBasedParserCache.CACHE_VERSION
      );
      Logger.debug('Cache size: ' + this._cache.size);
      return;
    }

    if (!cacheUri) {
      return;
    }

    try {
      const data = await workspace.fs.readFile(cacheUri);
      const content = Buffer.from(data).toString('utf8');
      const source = JSON.parse(content);
      this._cache.load(source);
    } catch (e: any) {
      if (e.code !== 'FileNotFound' && e.name !== 'EntryNotFound (FileSystemError)') {
        Logger.warn(`Failed to load cache from ${cacheUri.toString()}: ${e}`);
        await this.clear();
      }
    }
    Logger.debug('Cache size: ' + this._cache.size);
  }

  async clear(): Promise<void> {
    this._cache.clear();
    const cacheUri = this.getCacheUri();
    if (cacheUri) {
      try {
        await workspace.fs.delete(cacheUri);
      } catch (e: any) {
        if (e.code !== 'FileNotFound' && e.name !== 'EntryNotFound (FileSystemError)') {
          Logger.warn(`Failed to clear cache file at ${cacheUri.toString()}: ${e}`);
        }
      }
    }
  }

  get(uri: URI): ParserCacheEntry {
    const result = this._cache.get(uri.toString());
    if (result) {
      // The cache returns a plain object, but we need an actual
      // instance of URI in the resource (we check instanceof in the code),
      // so to be sure we convert it here.
      const { checksum, resource } = result;
      const rehydrated = {
        ...resource,
        uri: new URI(resource.uri),
      };
      return {
        checksum,
        resource: rehydrated,
      };
    }
    return undefined;
  }

  has(uri: URI): boolean {
    return this._cache.has(uri.toString());
  }

  set(uri: URI, entry: ParserCacheEntry): void {
    this._cache.set(uri.toString(), entry);
    this.scheduleSync();
  }

  del(uri: URI): void {
    this._cache.delete(uri.toString());
    this.scheduleSync();
  }

  private scheduleSync = debounce(() => {
    this.performSync();
  }, 1000);

  private async performSync() {
    if (this._syncing) {
      this._needsSync = true;
      return;
    }

    const cacheUri = this.getCacheUri();
    if (!cacheUri) return;

    this._syncing = true;
    this._needsSync = false;

    try {
      Logger.debug('Updating parser cache file');
      if (this.context.storageUri) {
        await workspace.fs.createDirectory(this.context.storageUri);
      }
      const dumped = this._cache.dump();
      const payload = JSON.stringify(dumped);
      const data = Buffer.from(payload, 'utf8');
      
      // VS Code fs.writeFile is atomic per file system provider implementation
      await workspace.fs.writeFile(cacheUri, data);
    } catch (e: any) {
      Logger.warn(`Failed to sync parser cache: ${e}`);
    } finally {
      this._syncing = false;
      if (this._needsSync) {
        this.performSync();
      }
    }
  }
}

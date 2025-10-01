import { debounce } from 'lodash';
import LRU from 'lru-cache';
import { ExtensionContext } from 'vscode';
import { URI } from '../core/model/uri';
import {
  ParserCache,
  ParserCacheEntry,
} from '../core/services/markdown-parser';
import { Logger } from '../core/utils/log';

/**
 * This is a best effort implementation to cache resources.
 * It's not a perfect solution, but it's a good start.
 *
 * We use the URI and a checksum of the markdown file to cache the resource.
 */
export default class VsCodeBasedParserCache<T> implements ParserCache<T> {
  static CACHE_NAME = 'foam-cache';
  private _cache: LRU<string, ParserCacheEntry<T>>;
  private delayedSync = createDelayedSync<T>();
  private factory: (uri: URI) => T;

  constructor(
    private context: ExtensionContext,
    factory: (uri: URI) => T,
    size = 10000
  ) {
    this._cache = new LRU({
      max: size,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
    this.factory = factory;
    const source = context.workspaceState.get(
      VsCodeBasedParserCache.CACHE_NAME,
      []
    );
    try {
      this._cache.load(source);
    } catch (e) {
      Logger.warn(`Failed to load cache: ${e}`);
      this.clear();
    }
    Logger.debug('Cache size: ' + this._cache.size);
  }

  clear(): void {
    this._cache.clear();
    this.context.workspaceState.update(VsCodeBasedParserCache.CACHE_NAME, []);
  }

  get(uri: URI): ParserCacheEntry<T> {
    const result = this._cache.get(uri.toString());
    if (result) {
      // The cache returns a plain object, but we need an actual
      // instance of URI in the resource (we check instanceof in the code),
      // so to be sure we convert it here.
      const { checksum, target } = result;

      const rehydrated = this.factory(uri);
      Object.assign(rehydrated, target, { uri: uri });

      return {
        checksum,
        target: rehydrated,
      };
    }
    return undefined;
  }

  has(uri: URI): boolean {
    return this._cache.has(uri.toString());
  }

  set(uri: URI, entry: ParserCacheEntry<T>): void {
    this._cache.set(uri.toString(), entry);
    this.delayedSync(this._cache, this.context);
  }

  del(uri: URI): void {
    this._cache.delete(uri.toString());
    this.delayedSync(this._cache, this.context);
  }
}

function createDelayedSync<T>() {
  return debounce(
    (cache: LRU<string, ParserCacheEntry<T>>, context: ExtensionContext) => {
      Logger.debug('Updating parser cache');
      context.workspaceState.update(
        VsCodeBasedParserCache.CACHE_NAME,
        cache.dump()
      );
    },
    1000
  );
}

import { LRUCache } from 'lru-cache';
import { FoamWorkspace, URI } from '@foam/core';
import type { IDisposable } from '@foam/core';

/**
 * Default budget for cached content, expressed in characters (~10MB of text).
 * The real memory footprint can reach about twice this, as entries also
 * memoize their line-split view on first use (see {@link ContentCache.readLines}).
 */
const DEFAULT_MAX_SIZE_IN_CHARS = 10 * 1024 * 1024;

interface CacheEntry {
  content: string;
  /** Lazily computed by {@link ContentCache.readLines}. */
  lines?: string[];
}

/**
 * Caches the markdown content of workspace resources for presentation
 * purposes (tree view labels and tooltips, hover and completion previews).
 * `readAsMarkdown` is a drop-in replacement for the workspace method of the
 * same name it wraps.
 *
 * This cache must NOT be used for anything feeding the Foam model (parsing,
 * graph building): a stale entry here can only show a slightly outdated
 * label until the next refresh, whereas a stale read in the model pipeline
 * would corrupt the workspace state.
 *
 * Entries are invalidated by the workspace's own resource events, so the
 * cache can never outlive what the workspace knows about a file. The cache
 * is in-memory only.
 */
export class ContentCache implements IDisposable {
  private cache: LRUCache<string, CacheEntry>;
  private inFlight = new Map<string, Promise<CacheEntry | null>>();
  private listeners: IDisposable[];

  constructor(
    private workspace: FoamWorkspace,
    options: { maxSizeInChars?: number } = {}
  ) {
    this.cache = new LRUCache({
      maxSize: options.maxSizeInChars ?? DEFAULT_MAX_SIZE_IN_CHARS,
      sizeCalculation: entry => Math.max(1, entry.content.length),
    });
    this.listeners = [
      workspace.onDidUpdate(change => this.invalidate(change.new.uri)),
      workspace.onDidDelete(resource => this.invalidate(resource.uri)),
    ];
  }

  /**
   * Returns the markdown content of the resource, reading it from the
   * workspace on cache miss.
   * Concurrent reads of the same URI share a single workspace read.
   *
   * Returns `null` if the resource cannot be read.
   */
  readAsMarkdown(uri: URI): Promise<string | null> {
    if (uri.fragment) {
      // for fragment URIs readAsMarkdown returns the section/block content,
      // which invalidation (keyed by resource URI) would not catch
      return this.workspace.readAsMarkdown(uri);
    }
    return this.getEntry(uri).then(entry =>
      entry === null ? null : entry.content
    );
  }

  /**
   * Returns the markdown content of the resource split into lines.
   * The split is computed once per cache entry, so callers needing a single
   * line out of a large file (e.g. tree item labels) don't re-split the
   * whole content for each access.
   *
   * Returns `null` if the resource cannot be read.
   */
  async readLines(uri: URI): Promise<string[] | null> {
    if (uri.fragment) {
      const content = await this.workspace.readAsMarkdown(uri);
      return content === null ? null : content.split('\n');
    }
    const entry = await this.getEntry(uri);
    if (entry === null) {
      return null;
    }
    entry.lines ??= entry.content.split('\n');
    return entry.lines;
  }

  private getEntry(uri: URI): Promise<CacheEntry | null> {
    const key = uri.toString();
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    const pending = this.inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const promise = (async () => {
      try {
        const content = await this.workspace.readAsMarkdown(uri);
        if (content === null) {
          return null;
        }
        const entry: CacheEntry = { content };
        // an invalidation while reading removes the in-flight entry, in
        // which case the result may be stale and must not be cached
        if (this.inFlight.get(key) === promise) {
          this.cache.set(key, entry);
        }
        return entry;
      } finally {
        if (this.inFlight.get(key) === promise) {
          this.inFlight.delete(key);
        }
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }

  private invalidate(uri: URI) {
    const key = uri.toString();
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  dispose() {
    this.listeners.forEach(listener => listener.dispose());
    this.listeners = [];
    this.cache.clear();
    this.inFlight.clear();
  }
}

const perWorkspace = new WeakMap<FoamWorkspace, ContentCache>();

/**
 * Returns the shared {@link ContentCache} for the given workspace, creating
 * it on first use. The cache lives exactly as long as the workspace: its
 * only external references are the workspace's own event subscriptions, so
 * both are garbage collected together and no explicit disposal is needed.
 */
export function getContentCacheFor(workspace: FoamWorkspace): ContentCache {
  let cache = perWorkspace.get(workspace);
  if (cache === undefined) {
    cache = new ContentCache(workspace);
    perWorkspace.set(workspace, cache);
  }
  return cache;
}

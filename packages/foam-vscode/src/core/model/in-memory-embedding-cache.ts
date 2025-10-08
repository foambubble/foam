import { URI } from './uri';
import { EmbeddingCache, EmbeddingCacheEntry } from './embedding-cache';

/**
 * Simple in-memory implementation of embedding cache
 */
export class InMemoryEmbeddingCache implements EmbeddingCache {
  private cache: Map<string, EmbeddingCacheEntry> = new Map();

  get(uri: URI): EmbeddingCacheEntry {
    return this.cache.get(uri.toString());
  }

  has(uri: URI): boolean {
    return this.cache.has(uri.toString());
  }

  set(uri: URI, entry: EmbeddingCacheEntry): void {
    this.cache.set(uri.toString(), entry);
  }

  del(uri: URI): void {
    this.cache.delete(uri.toString());
  }

  clear(): void {
    this.cache.clear();
  }
}

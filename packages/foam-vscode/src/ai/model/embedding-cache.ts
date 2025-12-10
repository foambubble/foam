import { URI } from '../../core/model/uri';
import { ICache } from '../../core/utils/cache';

type Checksum = string;

/**
 * Cache entry for embeddings
 */
export interface EmbeddingCacheEntry {
  checksum: Checksum;
  embedding: number[];
}

/**
 * Cache for embeddings, keyed by URI
 */
export type EmbeddingCache = ICache<URI, EmbeddingCacheEntry>;

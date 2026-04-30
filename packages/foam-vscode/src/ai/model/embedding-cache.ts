import { URI } from '@foam/core';
import { ICache } from '@foam/core';

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

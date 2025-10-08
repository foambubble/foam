import { URI } from './uri';
import { ICache } from '../utils/cache';

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

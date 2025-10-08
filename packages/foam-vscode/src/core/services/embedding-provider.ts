/**
 * Provider interface for generating text embeddings
 */
export interface EmbeddingProvider {
  /**
   * Generate an embedding vector for the given text
   * @param text The text to embed
   * @returns A promise that resolves to the embedding vector
   */
  embed(text: string): Promise<number[]>;

  /**
   * Check if the embedding service is available and ready to use
   * @returns A promise that resolves to true if available, false otherwise
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get information about the embedding model
   * @returns Model metadata including name and vector dimensions
   */
  getModelInfo(): EmbeddingModelInfo;
}

/**
 * Metadata about an embedding model
 */
export interface EmbeddingModelInfo {
  /** The name of the embedding model */
  name: string;
  /** The dimensionality of the embedding vectors */
  dimensions: number;
}

/**
 * Represents a text embedding with metadata
 */
export interface Embedding {
  /** The embedding vector */
  vector: number[];
  /** Timestamp when the embedding was created */
  createdAt: number;
}

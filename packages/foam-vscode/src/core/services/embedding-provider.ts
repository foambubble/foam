/**
 * Information about an embedding provider and its model
 */
export interface EmbeddingProviderInfo {
  /** Human-readable name of the provider (e.g., "Ollama", "OpenAI") */
  name: string;

  /** Type of provider */
  type: 'local' | 'remote';

  /** Model information */
  model: {
    /** Model name (e.g., "nomic-embed-text", "text-embedding-3-small") */
    name: string;
    /** Vector dimensions */
    dimensions: number;
  };

  /** Optional description of the provider */
  description?: string;

  /** Backend endpoint/URL if applicable */
  endpoint?: string;

  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

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
   * Get information about the provider and its model
   * @returns Provider metadata including name, type, model info, and configuration
   */
  getProviderInfo(): EmbeddingProviderInfo;
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

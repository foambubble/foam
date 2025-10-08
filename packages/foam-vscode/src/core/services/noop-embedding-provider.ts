import { EmbeddingProvider, EmbeddingModelInfo } from './embedding-provider';

/**
 * A no-op embedding provider that does nothing.
 * Used when no real embedding provider is available.
 */
export class NoOpEmbeddingProvider implements EmbeddingProvider {
  async embed(_text: string): Promise<number[]> {
    return [];
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  getModelInfo(): EmbeddingModelInfo {
    return {
      name: 'none',
      dimensions: 0,
    };
  }
}

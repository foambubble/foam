import { EmbeddingProvider, EmbeddingProviderInfo } from './embedding-provider';

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

  getProviderInfo(): EmbeddingProviderInfo {
    return {
      name: 'None',
      type: 'local',
      model: {
        name: 'none',
        dimensions: 0,
      },
      description: 'No embedding provider configured',
    };
  }
}

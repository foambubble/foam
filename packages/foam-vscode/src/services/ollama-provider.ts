import {
  EmbeddingProvider,
  EmbeddingProviderInfo,
} from '../core/services/embedding-provider';
import { Logger } from '../core/utils/log';

/**
 * Configuration for Ollama embedding provider
 */
export interface OllamaConfig {
  /** Base URL for Ollama API (default: http://localhost:11434) */
  url: string;
  /** Model name to use for embeddings (default: nomic-embed-text) */
  model: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout: number;
}

/**
 * Default configuration for Ollama
 */
export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  url: 'http://localhost:11434',
  model: 'nomic-embed-text',
  timeout: 30000,
};

/**
 * Ollama API response for embeddings
 */
interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Embedding provider that uses Ollama for generating embeddings
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = { ...DEFAULT_OLLAMA_CONFIG, ...config };
  }

  /**
   * Generate an embedding for the given text
   */
  async embed(text: string): Promise<number[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      const response = await fetch(`${this.config.url}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI service error (${response.status}): ${errorText}`);
      }

      const data: OllamaEmbeddingResponse = await response.json();
      return data.embedding;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(
            'AI service took too long to respond. It may be busy processing another request.'
          );
        }
        if (
          error.message.includes('fetch') ||
          error.message.includes('ECONNREFUSED')
        ) {
          throw new Error(
            `Cannot connect to Ollama at ${this.config.url}. Make sure Ollama is installed and running.`
          );
        }
      }
      throw error;
    }
  }

  /**
   * Check if Ollama is available and the model is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try to reach the Ollama API
      const response = await fetch(`${this.config.url}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        Logger.warn(
          `Ollama API returned status ${response.status} when checking availability`
        );
        return false;
      }

      return true;
    } catch (error) {
      Logger.debug(
        `Ollama not available at ${this.config.url}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return false;
    }
  }

  /**
   * Get provider information including model details
   */
  getProviderInfo(): EmbeddingProviderInfo {
    return {
      name: 'Ollama',
      type: 'local',
      model: {
        name: this.config.model,
        // nomic-embed-text produces 768-dimensional embeddings
        dimensions: 768,
      },
      description: 'Local embedding provider using Ollama',
      endpoint: this.config.url,
      metadata: {
        timeout: this.config.timeout,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): OllamaConfig {
    return { ...this.config };
  }
}

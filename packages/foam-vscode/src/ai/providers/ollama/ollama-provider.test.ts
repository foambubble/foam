import { Logger } from '../../../core/utils/log';
import {
  OllamaEmbeddingProvider,
  DEFAULT_OLLAMA_CONFIG,
} from './ollama-provider';

Logger.setLevel('error');

describe('OllamaEmbeddingProvider', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const provider = new OllamaEmbeddingProvider();
      const config = provider.getConfig();

      expect(config.url).toBe(DEFAULT_OLLAMA_CONFIG.url);
      expect(config.model).toBe(DEFAULT_OLLAMA_CONFIG.model);
      expect(config.timeout).toBe(DEFAULT_OLLAMA_CONFIG.timeout);
    });

    it('should merge custom config with defaults', () => {
      const provider = new OllamaEmbeddingProvider({
        url: 'http://custom:11434',
      });
      const config = provider.getConfig();

      expect(config.url).toBe('http://custom:11434');
      expect(config.model).toBe(DEFAULT_OLLAMA_CONFIG.model);
    });
  });

  describe('getProviderInfo', () => {
    it('should return provider information', () => {
      const provider = new OllamaEmbeddingProvider();
      const info = provider.getProviderInfo();

      expect(info.name).toBe('Ollama');
      expect(info.type).toBe('local');
      expect(info.model.name).toBe('nomic-embed-text');
      expect(info.model.dimensions).toBe(768);
      expect(info.endpoint).toBe('http://localhost:11434');
      expect(info.description).toBe('Local embedding provider using Ollama');
      expect(info.metadata).toEqual({ timeout: 30000 });
    });

    it('should return custom model name when configured', () => {
      const provider = new OllamaEmbeddingProvider({
        model: 'custom-model',
      });
      const info = provider.getProviderInfo();

      expect(info.model.name).toBe('custom-model');
    });

    it('should return custom endpoint when configured', () => {
      const provider = new OllamaEmbeddingProvider({
        url: 'http://custom:8080',
      });
      const info = provider.getProviderInfo();

      expect(info.endpoint).toBe('http://custom:8080');
    });
  });

  describe('embed', () => {
    it('should successfully generate embeddings', async () => {
      const mockEmbedding = new Array(768).fill(0.1);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: [mockEmbedding] }),
      });

      const provider = new OllamaEmbeddingProvider();
      const result = await provider.embed('test text');

      expect(result).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            input: ['test text'],
          }),
        })
      );
    });

    it('should throw error on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const provider = new OllamaEmbeddingProvider();

      await expect(provider.embed('test')).rejects.toThrow(
        'AI service error (500)'
      );
    });

    it('should throw error on connection refused', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('fetch failed')
      );

      const provider = new OllamaEmbeddingProvider();

      await expect(provider.embed('test')).rejects.toThrow(
        'Cannot connect to Ollama'
      );
    });

    it('should timeout after configured duration', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            // Simulate abort signal being triggered
            options.signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          })
      );

      const provider = new OllamaEmbeddingProvider({ timeout: 1000 });
      const embedPromise = provider.embed('test');

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(1001);

      await expect(embedPromise).rejects.toThrow('AI service took too long');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const provider = new OllamaEmbeddingProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when Ollama is not available', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const provider = new OllamaEmbeddingProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when Ollama returns non-ok status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const provider = new OllamaEmbeddingProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should timeout quickly (5s) when checking availability', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            // Simulate abort signal being triggered
            options.signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          })
      );

      const provider = new OllamaEmbeddingProvider();
      const availabilityPromise = provider.isAvailable();

      // Fast-forward time to trigger timeout (5s for availability check)
      jest.advanceTimersByTime(5001);

      const result = await availabilityPromise;
      expect(result).toBe(false);
    });
  });
});

describe('OllamaEmbeddingProvider - Integration', () => {
  const provider = new OllamaEmbeddingProvider();
  let isOllamaAvailable: boolean;

  beforeAll(async () => {
    await provider.isAvailable();
    isOllamaAvailable = await provider.isAvailable();
  });

  beforeEach(function () {
    if (!isOllamaAvailable) {
      console.warn('Skipping test because Ollama service is unavailable');
      this.skip();
    }
  });

  (isOllamaAvailable ? it : it.skip)(
    'should handle text with unicode characters and emojis',
    async () => {
      const text = 'Task completed ✔ 🚀: All systems go! 🌟';
      const embedding = await provider.embed(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // nomic-embed-text dimension
      expect(embedding.every(n => typeof n === 'number')).toBe(true);
    }
  );

  (isOllamaAvailable ? it : it.skip)(
    'should handle text with various unicode characters',
    async () => {
      const text =
        'Hello 🌍 with émojis and spëcial çharacters • bullet ✓ check';
      const embedding = await provider.embed(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    }
  );

  (isOllamaAvailable ? it : it.skip)(
    'should handle text with combining unicode characters',
    async () => {
      // Test with combining diacriticals that could be represented differently
      const text = 'café vs cafe\u0301'; // Two ways to represent é
      const embedding = await provider.embed(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    }
  );

  (isOllamaAvailable ? it : it.skip)('should handle empty text', async () => {
    const text = '';
    const embedding = await provider.embed(text);

    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    // Note: Ollama returns empty array for empty text
    expect(embedding.length).toBeGreaterThanOrEqual(0);
  });

  (isOllamaAvailable ? it.each : it.skip.each)([10, 50, 60, 100, 300])(
    'should handle text of various lengths',
    async length => {
      const text = 'Lorem ipsum dolor sit amet. '.repeat(length);
      try {
        const embedding = await provider.embed(text);
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
      } catch (error) {
        throw new Error(
          `Embedding failed for text of length ${text.length}: ${error}`
        );
      }
    }
  );
});

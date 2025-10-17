import {
  OllamaEmbeddingProvider,
  DEFAULT_OLLAMA_CONFIG,
} from './ollama-provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('OllamaEmbeddingProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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
        json: async () => ({ embedding: mockEmbedding }),
      });

      const provider = new OllamaEmbeddingProvider();
      const result = await provider.embed('test text');

      expect(result).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: 'test text',
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
        'Ollama API error (500)'
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
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 35000);
          })
      );

      const provider = new OllamaEmbeddingProvider({ timeout: 1000 });
      const embedPromise = provider.embed('test');

      // Fast-forward time
      jest.advanceTimersByTime(1001);

      await expect(embedPromise).rejects.toThrow('Cannot connect to Ollama');
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
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 10000);
          })
      );

      const provider = new OllamaEmbeddingProvider();
      const availabilityPromise = provider.isAvailable();

      // Fast-forward time
      jest.advanceTimersByTime(5001);

      const result = await availabilityPromise;
      expect(result).toBe(false);
    });
  });
});

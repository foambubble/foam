import { FoamEmbeddings } from './embeddings';
import { FoamWorkspace } from './workspace';
import {
  EmbeddingProvider,
  EmbeddingProviderInfo,
} from '../services/embedding-provider';
import { createTestNote } from '../../test/test-utils';
import { URI } from './uri';

describe('FoamEmbeddings', () => {
  let workspace: FoamWorkspace;
  let mockProvider: EmbeddingProvider;

  beforeEach(() => {
    workspace = new FoamWorkspace();

    // Create a simple mock provider
    mockProvider = {
      async embed(text: string): Promise<number[]> {
        // Return a simple embedding based on text length
        // In real tests, we'd return predictable vectors
        const vector = new Array(384).fill(0);
        vector[0] = text.length / 100; // Simple deterministic embedding
        return vector;
      },
      async isAvailable(): Promise<boolean> {
        return true;
      },
      getProviderInfo(): EmbeddingProviderInfo {
        return {
          name: 'Test Provider',
          type: 'local',
          model: { name: 'test-model', dimensions: 384 },
        };
      },
    };
  });

  afterEach(() => {
    workspace.dispose();
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const vector = [1, 2, 3, 4, 5];
      const similarity = embeddings.cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = embeddings.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = embeddings.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should return 0 for zero vectors', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const similarity = embeddings.cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should throw error for vectors of different lengths', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => embeddings.cosineSimilarity(vec1, vec2)).toThrow();
    });
  });

  describe('updateResource', () => {
    it('should create embedding for a resource', async () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const note = createTestNote({
        uri: '/path/to/note.md',
        title: 'Test Note',
        text: 'This is test content',
      });
      workspace.set(note);

      await embeddings.updateResource(note.uri);

      const embedding = embeddings.getEmbedding(note.uri);
      expect(embedding).not.toBeNull();
      expect(embedding?.length).toBe(384);
    });

    it('should remove embedding when resource is deleted', async () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const note = createTestNote({
        uri: '/path/to/note.md',
        title: 'Test Note',
      });
      workspace.set(note);

      await embeddings.updateResource(note.uri);
      expect(embeddings.getEmbedding(note.uri)).not.toBeNull();

      workspace.delete(note.uri);
      await embeddings.updateResource(note.uri);

      expect(embeddings.getEmbedding(note.uri)).toBeNull();
    });
  });

  describe('hasEmbeddings', () => {
    it('should return false when no embeddings exist', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      expect(embeddings.hasEmbeddings()).toBe(false);
    });

    it('should return true when embeddings exist', async () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const note = createTestNote({ uri: '/path/to/note.md' });
      workspace.set(note);

      await embeddings.updateResource(note.uri);

      expect(embeddings.hasEmbeddings()).toBe(true);
    });
  });

  describe('getSimilar', () => {
    it('should return empty array when no embedding exists for target', () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const uri = URI.file('/path/to/note.md');

      const similar = embeddings.getSimilar(uri, 5);

      expect(similar).toEqual([]);
    });

    it('should return similar notes sorted by similarity', async () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);

      // Create notes with different content
      const note1 = createTestNote({
        uri: '/note1.md',
        text: 'Short',
      });
      const note2 = createTestNote({
        uri: '/note2.md',
        text: 'Medium length text',
      });
      const note3 = createTestNote({
        uri: '/note3.md',
        text: 'Very long text content here',
      });

      workspace.set(note1);
      workspace.set(note2);
      workspace.set(note3);

      await embeddings.updateResource(note1.uri);
      await embeddings.updateResource(note2.uri);
      await embeddings.updateResource(note3.uri);

      // Get similar to note2
      const similar = embeddings.getSimilar(note2.uri, 10);

      expect(similar.length).toBe(2); // Excludes self
      expect(similar[0].uri.path).toBeTruthy();
      expect(similar[0].similarity).toBeGreaterThanOrEqual(
        similar[1].similarity
      );
    });

    it('should respect topK parameter', async () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);

      // Create multiple notes
      for (let i = 0; i < 10; i++) {
        const note = createTestNote({
          uri: `/note${i}.md`,
          text: `Content ${i}`,
        });
        workspace.set(note);
        await embeddings.updateResource(note.uri);
      }

      const target = URI.file('/note0.md');
      const similar = embeddings.getSimilar(target, 3);

      expect(similar.length).toBe(3);
    });

    it('should not include self in similar results', async () => {
      const embeddings = new FoamEmbeddings(workspace, mockProvider);
      const note = createTestNote({ uri: '/note.md' });
      workspace.set(note);
      await embeddings.updateResource(note.uri);

      const similar = embeddings.getSimilar(note.uri, 10);

      expect(similar.find(s => s.uri.path === note.uri.path)).toBeUndefined();
    });
  });

  describe('fromWorkspace with monitoring', () => {
    it('should automatically update when resource is added', async () => {
      const embeddings = FoamEmbeddings.fromWorkspace(
        workspace,
        mockProvider,
        true
      );

      const note = createTestNote({ uri: '/new-note.md' });
      workspace.set(note);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));

      const embedding = embeddings.getEmbedding(note.uri);
      expect(embedding).not.toBeNull();

      embeddings.dispose();
    });

    it('should automatically update when resource is modified', async () => {
      const note = createTestNote({
        uri: '/note.md',
        text: 'Original content',
      });
      workspace.set(note);

      const embeddings = FoamEmbeddings.fromWorkspace(
        workspace,
        mockProvider,
        true
      );

      await embeddings.updateResource(note.uri);
      const originalEmbedding = embeddings.getEmbedding(note.uri);

      // Update note
      const updatedNote = createTestNote({
        uri: '/note.md',
        text: 'Different content that is longer',
      });
      workspace.set(updatedNote);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));

      const newEmbedding = embeddings.getEmbedding(note.uri);
      expect(newEmbedding).not.toEqual(originalEmbedding);

      embeddings.dispose();
    });

    it('should automatically remove embedding when resource is deleted', async () => {
      const note = createTestNote({ uri: '/note.md' });
      workspace.set(note);

      const embeddings = FoamEmbeddings.fromWorkspace(
        workspace,
        mockProvider,
        true
      );

      await embeddings.updateResource(note.uri);
      expect(embeddings.getEmbedding(note.uri)).not.toBeNull();

      workspace.delete(note.uri);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(embeddings.getEmbedding(note.uri)).toBeNull();

      embeddings.dispose();
    });
  });
});

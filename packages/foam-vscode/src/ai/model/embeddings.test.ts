import { FoamEmbeddings } from './embeddings';
import {
  EmbeddingProvider,
  EmbeddingProviderInfo,
} from '../services/embedding-provider';
import {
  createTestWorkspace,
  InMemoryDataStore,
  waitForExpect,
} from '../../test/test-utils';
import { URI } from '../../core/model/uri';

// Helper to create a simple mock provider
class MockProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const vector = new Array(384).fill(0);
    vector[0] = text.length / 100; // Deterministic based on text length
    return vector;
  }
  async isAvailable(): Promise<boolean> {
    return true;
  }
  getProviderInfo(): EmbeddingProviderInfo {
    return {
      name: 'Test Provider',
      type: 'local',
      model: { name: 'test-model', dimensions: 384 },
    };
  }
}

const ROOT = [URI.parse('/', 'file')];

describe('FoamEmbeddings', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      const vector = [1, 2, 3, 4, 5];
      const similarity = embeddings.cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 5);
      workspace.dispose();
    });

    it('should return 0 for orthogonal vectors', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = embeddings.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0.0, 5);
      workspace.dispose();
    });

    it('should return -1 for opposite vectors', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = embeddings.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1.0, 5);
      workspace.dispose();
    });

    it('should return 0 for zero vectors', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const similarity = embeddings.cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
      workspace.dispose();
    });

    it('should throw error for vectors of different lengths', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => embeddings.cosineSimilarity(vec1, vec2)).toThrow();
      workspace.dispose();
    });
  });

  describe('updateResource', () => {
    it('should create embedding for a resource', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      const noteUri = URI.parse('/path/to/note.md', 'file');
      datastore.set(noteUri, '# Test Note\n\nThis is test content');
      await workspace.fetchAndSet(noteUri);

      await embeddings.updateResource(noteUri);

      const embedding = embeddings.getEmbedding(noteUri);
      expect(embedding).not.toBeNull();
      expect(embedding?.length).toBe(384);

      workspace.dispose();
    });

    it('should remove embedding when resource is deleted', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      const noteUri = URI.parse('/path/to/note.md', 'file');
      datastore.set(noteUri, '# Test Note\n\nContent');
      await workspace.fetchAndSet(noteUri);

      await embeddings.updateResource(noteUri);
      expect(embeddings.getEmbedding(noteUri)).not.toBeNull();

      workspace.delete(noteUri);
      await embeddings.updateResource(noteUri);

      expect(embeddings.getEmbedding(noteUri)).toBeNull();

      workspace.dispose();
    });

    it('should create different embeddings for different content', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      const note1Uri = URI.parse('/note1.md', 'file');
      const note2Uri = URI.parse('/note2.md', 'file');

      // Same title, different content
      datastore.set(note1Uri, '# Same Title\n\nShort content');
      datastore.set(
        note2Uri,
        '# Same Title\n\nThis is much longer content that should produce a different embedding vector'
      );

      await workspace.fetchAndSet(note1Uri);
      await workspace.fetchAndSet(note2Uri);

      await embeddings.updateResource(note1Uri);
      await embeddings.updateResource(note2Uri);

      const embedding1 = embeddings.getEmbedding(note1Uri);
      const embedding2 = embeddings.getEmbedding(note2Uri);

      expect(embedding1).not.toBeNull();
      expect(embedding2).not.toBeNull();

      // Embeddings should be different because content is different
      // Our mock provider uses text.length for the first vector component
      expect(embedding1![0]).not.toBe(embedding2![0]);

      workspace.dispose();
    });
  });

  describe('hasEmbeddings', () => {
    it('should return false when no embeddings exist', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      expect(embeddings.hasEmbeddings()).toBe(false);
      workspace.dispose();
    });

    it('should return true when embeddings exist', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      const noteUri = URI.parse('/path/to/note.md', 'file');
      datastore.set(noteUri, '# Note\n\nContent');
      await workspace.fetchAndSet(noteUri);

      await embeddings.updateResource(noteUri);

      expect(embeddings.hasEmbeddings()).toBe(true);

      workspace.dispose();
    });
  });

  describe('getSimilar', () => {
    it('should return empty array when no embedding exists for target', () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());
      const uri = URI.parse('/path/to/note.md', 'file');

      const similar = embeddings.getSimilar(uri, 5);

      expect(similar).toEqual([]);
      workspace.dispose();
    });

    it('should return similar notes sorted by similarity', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      // Create notes with different content lengths
      const note1Uri = URI.parse('/note1.md', 'file');
      const note2Uri = URI.parse('/note2.md', 'file');
      const note3Uri = URI.parse('/note3.md', 'file');

      datastore.set(note1Uri, '# Note 1\n\nShort');
      datastore.set(note2Uri, '# Note 2\n\nMedium length text');
      datastore.set(note3Uri, '# Note 3\n\nVery long text content here');

      await workspace.fetchAndSet(note1Uri);
      await workspace.fetchAndSet(note2Uri);
      await workspace.fetchAndSet(note3Uri);

      await embeddings.updateResource(note1Uri);
      await embeddings.updateResource(note2Uri);
      await embeddings.updateResource(note3Uri);

      // Get similar to note2
      const similar = embeddings.getSimilar(note2Uri, 10);

      expect(similar.length).toBe(2); // Excludes self
      expect(similar[0].uri.path).toBeTruthy();
      expect(similar[0].similarity).toBeGreaterThanOrEqual(
        similar[1].similarity
      );

      workspace.dispose();
    });

    it('should respect topK parameter', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      // Create multiple notes
      for (let i = 0; i < 10; i++) {
        const noteUri = URI.parse(`/note${i}.md`, 'file');
        datastore.set(noteUri, `# Note ${i}\n\nContent ${i}`);
        await workspace.fetchAndSet(noteUri);
        await embeddings.updateResource(noteUri);
      }

      const target = URI.parse('/note0.md', 'file');
      const similar = embeddings.getSimilar(target, 3);

      expect(similar.length).toBe(3);

      workspace.dispose();
    });

    it('should not include self in similar results', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = new FoamEmbeddings(workspace, new MockProvider());

      const noteUri = URI.parse('/note.md', 'file');
      datastore.set(noteUri, '# Note\n\nContent');
      await workspace.fetchAndSet(noteUri);
      await embeddings.updateResource(noteUri);

      const similar = embeddings.getSimilar(noteUri, 10);

      expect(similar.find(s => s.uri.path === noteUri.path)).toBeUndefined();

      workspace.dispose();
    });
  });

  describe('fromWorkspace with monitoring', () => {
    it('should automatically update when resource is added', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const embeddings = FoamEmbeddings.fromWorkspace(
        workspace,
        new MockProvider(),
        true
      );

      const noteUri = URI.parse('/new-note.md', 'file');
      datastore.set(noteUri, '# New Note\n\nContent');
      await workspace.fetchAndSet(noteUri);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));

      const embedding = embeddings.getEmbedding(noteUri);
      expect(embedding).not.toBeNull();

      embeddings.dispose();
      workspace.dispose();
    });

    it('should automatically update when resource is modified', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const noteUri = URI.parse('/note.md', 'file');

      datastore.set(noteUri, '# Note\n\nOriginal content');
      await workspace.fetchAndSet(noteUri);

      const embeddings = FoamEmbeddings.fromWorkspace(
        workspace,
        new MockProvider(),
        true
      );

      await embeddings.updateResource(noteUri);
      const originalEmbedding = embeddings.getEmbedding(noteUri);

      // Update the content of the note to simulate a change
      datastore.set(noteUri, '# Note\n\nDifferent content that is much longer');

      // Trigger workspace update event
      await workspace.fetchAndSet(noteUri);

      // Wait for automatic update
      await waitForExpect(
        () => {
          const newEmbedding = embeddings.getEmbedding(noteUri);
          expect(newEmbedding).not.toEqual(originalEmbedding);
        },
        1000,
        50
      );

      embeddings.dispose();
      workspace.dispose();
    });

    it('should automatically remove embedding when resource is deleted', async () => {
      const datastore = new InMemoryDataStore();
      const workspace = createTestWorkspace(ROOT, datastore);
      const noteUri = URI.parse('/note.md', 'file');

      datastore.set(noteUri, '# Note\n\nContent');
      await workspace.fetchAndSet(noteUri);

      const embeddings = FoamEmbeddings.fromWorkspace(
        workspace,
        new MockProvider(),
        true
      );

      await embeddings.updateResource(noteUri);
      expect(embeddings.getEmbedding(noteUri)).not.toBeNull();

      workspace.delete(noteUri);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(embeddings.getEmbedding(noteUri)).toBeNull();

      embeddings.dispose();
      workspace.dispose();
    });
  });
});

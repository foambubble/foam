import { Emitter } from '../common/event';
import { IDisposable } from '../common/lifecycle';
import { Logger } from '../utils/log';
import { EmbeddingProvider, Embedding } from '../services/embedding-provider';
import { FoamWorkspace } from './workspace';
import { URI } from './uri';
import { Resource } from './note';

/**
 * Represents a similar resource with its similarity score
 */
export interface SimilarResource {
  uri: URI;
  similarity: number;
}

/**
 * Manages embeddings for all resources in the workspace
 */
export class FoamEmbeddings implements IDisposable {
  /**
   * Maps resource URIs to their embeddings
   */
  private embeddings: Map<string, Embedding> = new Map();

  private onDidUpdateEmitter = new Emitter<void>();
  onDidUpdate = this.onDidUpdateEmitter.event;

  /**
   * List of disposables to destroy with the embeddings
   */
  private disposables: IDisposable[] = [];

  constructor(
    private readonly workspace: FoamWorkspace,
    private readonly provider: EmbeddingProvider
  ) {}

  /**
   * Get the embedding for a resource
   * @param uri The URI of the resource
   * @returns The embedding vector, or null if not found
   */
  public getEmbedding(uri: URI): number[] | null {
    const embedding = this.embeddings.get(uri.path);
    return embedding ? embedding.vector : null;
  }

  /**
   * Check if embeddings are available
   * @returns true if at least one embedding exists
   */
  public hasEmbeddings(): boolean {
    return this.embeddings.size > 0;
  }

  /**
   * Get the number of embeddings
   * @returns The count of embeddings
   */
  public size(): number {
    return this.embeddings.size;
  }

  /**
   * Find similar resources to a given resource
   * @param uri The URI of the target resource
   * @param topK The number of similar resources to return
   * @returns Array of similar resources sorted by similarity (highest first)
   */
  public getSimilar(uri: URI, topK: number = 10): SimilarResource[] {
    const targetEmbedding = this.getEmbedding(uri);
    if (!targetEmbedding) {
      return [];
    }

    const similarities: SimilarResource[] = [];

    for (const [path, embedding] of this.embeddings.entries()) {
      // Skip self
      if (path === uri.path) {
        continue;
      }

      const similarity = this.cosineSimilarity(
        targetEmbedding,
        embedding.vector
      );
      similarities.push({
        uri: URI.file(path),
        similarity,
      });
    }

    // Sort by similarity (highest first) and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param a First vector
   * @param b Second vector
   * @returns Similarity score between -1 and 1 (higher is more similar)
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Update embeddings for a single resource
   * @param uri The URI of the resource to update
   */
  public async updateResource(uri: URI): Promise<void> {
    const resource = this.workspace.find(uri);
    if (!resource) {
      // Resource deleted, remove embedding
      this.embeddings.delete(uri.path);
      this.onDidUpdateEmitter.fire();
      return;
    }

    // Skip non-note resources (attachments)
    if (resource.type !== 'note') {
      return;
    }

    try {
      const text = this.extractTextFromResource(resource);
      const vector = await this.provider.embed(text);

      this.embeddings.set(uri.path, {
        vector,
        createdAt: Date.now(),
      });

      this.onDidUpdateEmitter.fire();
    } catch (error) {
      Logger.error(`Failed to update embedding for ${uri.toFsPath()}`, error);
    }
  }

  /**
   * Rebuild all embeddings from scratch
   * @returns Promise that resolves when all embeddings are updated
   */
  public async update(): Promise<void> {
    const start = Date.now();
    this.embeddings.clear();

    // Filter to only process notes (not attachments)
    const allResources = Array.from(this.workspace.resources());
    const resources = allResources.filter(r => r.type === 'note');

    Logger.info(
      `Building embeddings for ${resources.length} notes (${allResources.length} total resources)...`
    );

    // Process embeddings sequentially to avoid overwhelming the service
    for (const resource of resources) {
      try {
        const text = this.extractTextFromResource(resource);
        const vector = await this.provider.embed(text);

        this.embeddings.set(resource.uri.path, {
          vector,
          createdAt: Date.now(),
        });
      } catch (error) {
        Logger.error(
          `Failed to generate embedding for ${resource.uri.toFsPath()}`,
          error
        );
      }
    }

    const end = Date.now();
    Logger.info(
      `Embeddings built for ${this.embeddings.size}/${
        resources.length
      } notes in ${end - start}ms`
    );
    this.onDidUpdateEmitter.fire();
  }

  /**
   * Extract text content from a resource for embedding
   * @param resource The resource to extract text from
   * @returns The text to embed
   */
  private extractTextFromResource(resource: Resource): string {
    // Combine title and content
    const parts: string[] = [];

    if (resource.title) {
      parts.push(resource.title);
    }

    // Use source content if available
    if (resource.source && resource.source.text) {
      parts.push(resource.source.text);
    }

    return parts.join('\n\n');
  }

  /**
   * Create FoamEmbeddings from a workspace
   * @param workspace The workspace to generate embeddings for
   * @param provider The embedding provider to use
   * @param keepMonitoring Whether to automatically update embeddings when workspace changes
   * @returns The FoamEmbeddings instance
   */
  public static fromWorkspace(
    workspace: FoamWorkspace,
    provider: EmbeddingProvider,
    keepMonitoring: boolean = false
  ): FoamEmbeddings {
    const embeddings = new FoamEmbeddings(workspace, provider);

    if (keepMonitoring) {
      // Update embeddings when resources change
      embeddings.disposables.push(
        workspace.onDidAdd(resource => {
          embeddings.updateResource(resource.uri);
        }),
        workspace.onDidUpdate(({ new: resource }) => {
          embeddings.updateResource(resource.uri);
        }),
        workspace.onDidDelete(resource => {
          embeddings.embeddings.delete(resource.uri.path);
          embeddings.onDidUpdateEmitter.fire();
        })
      );
    }

    return embeddings;
  }

  public dispose(): void {
    this.onDidUpdateEmitter.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.embeddings.clear();
  }
}

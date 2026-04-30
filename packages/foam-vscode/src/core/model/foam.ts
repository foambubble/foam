import {
  Foam as CoreFoam,
  bootstrap as coreBootstrap,
  IMatcher,
  IWatcher,
  IDataStore,
  ResourceParser,
  ResourceProvider,
  URI,
  Logger,
} from '@foam/core';
import { FoamEmbeddings } from '../../ai/model/embeddings';
import { InMemoryEmbeddingCache } from '../../ai/model/in-memory-embedding-cache';
import { EmbeddingProvider } from '../../ai/services/embedding-provider';
import { NoOpEmbeddingProvider } from '../../ai/services/noop-embedding-provider';

export type { Services } from '@foam/core';

export interface Foam extends CoreFoam {
  embeddings: FoamEmbeddings;
}

export const bootstrap = async (
  roots: URI[],
  matcher: IMatcher,
  watcher: IWatcher | undefined,
  dataStore: IDataStore,
  parser: ResourceParser,
  initialProviders: ResourceProvider[],
  defaultExtension: string = '.md',
  embeddingProvider?: EmbeddingProvider
): Promise<Foam> => {
  const core = await coreBootstrap(
    roots,
    matcher,
    watcher,
    dataStore,
    parser,
    initialProviders,
    defaultExtension
  );

  embeddingProvider = embeddingProvider ?? new NoOpEmbeddingProvider();
  const embeddings = FoamEmbeddings.fromWorkspace(
    core.workspace,
    embeddingProvider,
    true,
    new InMemoryEmbeddingCache()
  );

  if (await embeddingProvider.isAvailable()) {
    Logger.info('Embeddings service initialized');
  } else {
    Logger.warn(
      'Embedding provider not available. Semantic features will be disabled.'
    );
  }

  return {
    ...core,
    embeddings,
    dispose: () => {
      core.dispose();
      embeddings.dispose();
    },
  };
};

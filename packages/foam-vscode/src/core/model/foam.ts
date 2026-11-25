import {
  Foam as CoreFoam,
  BootstrapOptions,
  bootstrap as coreBootstrap,
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

export const bootstrap = async ({
  embeddingProvider = new NoOpEmbeddingProvider(),
  ...options
}: BootstrapOptions & {
  embeddingProvider?: EmbeddingProvider;
}): Promise<Foam> => {
  const core = await coreBootstrap(options);

  const embeddings = FoamEmbeddings.fromWorkspace(
    core.workspace,
    embeddingProvider,
    true,
    new InMemoryEmbeddingCache()
  );

  if (await embeddingProvider.isAvailable()) {
    Logger.info('Embeddings service initialized');
  } else {
    Logger.debug('Embedding provider not available. Semantic features will be disabled.');
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

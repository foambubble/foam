import { IDisposable } from '../common/lifecycle';
import { IDataStore, IMatcher, IWatcher } from '../services/datastore';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { FoamTags } from './tags';
import { FoamEmbeddings } from './embeddings';
import { EmbeddingProvider } from '../services/embedding-provider';
import { NoOpEmbeddingProvider } from '../services/noop-embedding-provider';
import { Logger, withTiming, withTimingAsync } from '../utils/log';

export interface Services {
  dataStore: IDataStore;
  parser: ResourceParser;
  matcher: IMatcher;
}

export interface Foam extends IDisposable {
  services: Services;
  workspace: FoamWorkspace;
  graph: FoamGraph;
  tags: FoamTags;
  embeddings: FoamEmbeddings;
}

export const bootstrap = async (
  matcher: IMatcher,
  watcher: IWatcher | undefined,
  dataStore: IDataStore,
  parser: ResourceParser,
  initialProviders: ResourceProvider[],
  defaultExtension: string = '.md',
  embeddingProvider?: EmbeddingProvider
) => {
  const workspace = await withTimingAsync(
    () =>
      FoamWorkspace.fromProviders(
        initialProviders,
        dataStore,
        defaultExtension
      ),
    ms => Logger.info(`Workspace loaded in ${ms}ms`)
  );

  const graph = withTiming(
    () => FoamGraph.fromWorkspace(workspace, true),
    ms => Logger.info(`Graph loaded in ${ms}ms`)
  );

  const tags = withTiming(
    () => FoamTags.fromWorkspace(workspace, true),
    ms => Logger.info(`Tags loaded in ${ms}ms`)
  );

  // Initialize embeddings with provider or fallback to no-op
  const provider = embeddingProvider ?? new NoOpEmbeddingProvider();
  const isAvailable = await provider.isAvailable();

  const embeddings = FoamEmbeddings.fromWorkspace(workspace, provider, true);

  if (isAvailable) {
    Logger.info('Embeddings service initialized');
  } else {
    Logger.warn(
      'Embedding provider not available. Semantic features will be disabled.'
    );
  }

  watcher?.onDidChange(async uri => {
    if (matcher.isMatch(uri)) {
      await workspace.fetchAndSet(uri);
    }
  });
  watcher?.onDidCreate(async uri => {
    await matcher.refresh();
    if (matcher.isMatch(uri)) {
      await workspace.fetchAndSet(uri);
    }
  });
  watcher?.onDidDelete(uri => {
    workspace.delete(uri);
  });

  const foam: Foam = {
    workspace,
    graph,
    tags,
    embeddings,
    services: {
      parser,
      dataStore,
      matcher,
    },
    dispose: () => {
      workspace.dispose();
      graph.dispose();
      embeddings.dispose();
    },
  };

  return foam;
};

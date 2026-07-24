import { IDisposable } from '../common/lifecycle';
import { Event } from '../common/event';
import { IDataStore, IMatcher, IWatcher } from '../services/datastore';
import { URI } from './uri';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { FoamTags } from './tags';
import { Logger, withTiming, withTimingAsync } from '../utils/log';

export interface Services {
  dataStore: IDataStore;
  parser: ResourceParser;
  matcher: IMatcher;
}

/**
 * How long to wait for file-create events to settle before refreshing the
 * matcher so that a burst of creates does not trigger one full workspace 
 * scan per create
 */
const CREATE_DEBOUNCE_MS = 100;

export interface Foam extends IDisposable {
  services: Services;
  workspace: FoamWorkspace;
  graph: FoamGraph;
  tags: FoamTags;
}

export const bootstrap = async (
  roots: URI[],
  matcher: IMatcher,
  watcher: IWatcher | undefined,
  dataStore: IDataStore,
  parser: ResourceParser,
  initialProviders: ResourceProvider[],
  defaultExtension: string = '.md',
  timingLogLevel: 'debug' | 'info' | 'off' = 'info',
  fetchConcurrency: number = 256
) => {
  const workspace = await withTimingAsync(
    () =>
      FoamWorkspace.fromProviders(
        roots,
        initialProviders,
        dataStore,
        defaultExtension,
        fetchConcurrency
      ),
    ms => (timingLogLevel === 'off' ? null : Logger[timingLogLevel](`Workspace loaded in ${ms}ms`))
  );

  const graph = withTiming(
    () => FoamGraph.fromWorkspace(workspace, true),
    ms => (timingLogLevel === 'off' ? null : Logger[timingLogLevel](`Graph loaded in ${ms}ms`))
  );

  const tags = withTiming(
    () => FoamTags.fromWorkspace(workspace, true),
    ms => (timingLogLevel === 'off' ? null : Logger[timingLogLevel](`Tags loaded in ${ms}ms`))
  );

  const subscriptions: IDisposable[] = [];

  if (watcher) {
    subscriptions.push(
      watcher.onDidChange(async uri => {
        if (matcher.isMatch(uri)) {
          await workspace.fetchAndSet(uri);
        }
      })
    );

    // Coalesce a burst of creates into a single refresh, then
    // process every accumulated URI. (issue #1668)
    const onDidCreateBatch = Event.debounce<URI, URI[]>(
      watcher.onDidCreate,
      (batch, uri) => (batch ? [...batch, uri] : [uri]),
      CREATE_DEBOUNCE_MS
    );
    subscriptions.push(
      onDidCreateBatch(async uris => {
        await matcher.refresh();
        for (const uri of uris) {
          if (matcher.isMatch(uri)) {
            await workspace.fetchAndSet(uri);
          }
        }
      })
    );

    subscriptions.push(
      watcher.onDidDelete(uri => {
        workspace.delete(uri);
      })
    );
  }

  const foam: Foam = {
    workspace,
    graph,
    tags,
    services: {
      parser,
      dataStore,
      matcher,
    },
    dispose: () => {
      subscriptions.forEach(s => s.dispose());
      workspace.dispose();
      graph.dispose();
    },
  };

  return foam;
};

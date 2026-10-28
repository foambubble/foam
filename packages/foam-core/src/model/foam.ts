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
    // A read that is still in flight when its resource is deleted must not put
    // the resource back: the file it read may have moved or gone since.
    const readsInFlight = new Map<string, Set<{ deleted: boolean }>>();
    subscriptions.push(
      workspace.onDidDelete(resource => {
        readsInFlight.get(resource.uri.path)?.forEach(r => (r.deleted = true));
      })
    );
    const fetchAndSetUnlessDeleted = async (uri: URI) => {
      const read = { deleted: false };
      const reads = readsInFlight.get(uri.path) ?? new Set();
      reads.add(read);
      readsInFlight.set(uri.path, reads);
      try {
        const resource = await workspace.fetch(uri);
        if (resource && !read.deleted) {
          workspace.set(resource);
        }
      } finally {
        reads.delete(read);
        if (reads.size === 0) {
          readsInFlight.delete(uri.path);
        }
      }
    };

    // Serialize change handling per URI: two rapid changes to the same file
    // would otherwise race on their reads, and the workspace would keep
    // whichever read completed LAST, not the latest content
    const pendingChanges = new Map<string, Promise<unknown>>();
    subscriptions.push(
      watcher.onDidChange(uri => {
        if (matcher.isMatch(uri)) {
          const key = uri.toString();
          const next = (pendingChanges.get(key) ?? Promise.resolve()).then(
            () => fetchAndSetUnlessDeleted(uri)
          );
          pendingChanges.set(key, next);
          next.finally(() => {
            if (pendingChanges.get(key) === next) {
              pendingChanges.delete(key);
            }
          });
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
            await fetchAndSetUnlessDeleted(uri);
          }
        }
      })
    );

    subscriptions.push(
      watcher.onDidDelete(uri => {
        // A watcher may report a folder deleted, moved or renamed as one
        // event, without its files
        const folderPrefix = uri.path.endsWith('/') ? uri.path : uri.path + '/';
        // A read of a file not indexed yet has no resource for the workspace
        // to delete, so nothing else marks it
        for (const [path, reads] of readsInFlight) {
          if (path === uri.path || path.startsWith(folderPrefix)) {
            reads.forEach(r => (r.deleted = true));
          }
        }
        if (workspace.delete(uri)) {
          return;
        }
        // Not a resource, so possibly a folder
        for (const resource of workspace.list()) {
          if (resource.uri.path.startsWith(folderPrefix)) {
            workspace.delete(resource.uri);
          }
        }
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
      tags.dispose();
      graph.dispose();
      workspace.dispose();
    },
  };

  return foam;
};

import { IDisposable } from '../common/lifecycle';
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
    services: {
      parser,
      dataStore,
      matcher,
    },
    dispose: () => {
      workspace.dispose();
      graph.dispose();
    },
  };

  return foam;
};

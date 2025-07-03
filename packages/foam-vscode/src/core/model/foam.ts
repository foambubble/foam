import { IDisposable } from '../common/lifecycle';
import { IDataStore, IMatcher, IWatcher } from '../services/datastore';
import { FoamWorkspace, RootChecker, DummyRootChecker } from './workspace';
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
  matcher: IMatcher,
  watcher: IWatcher | undefined,
  dataStore: IDataStore,
  parser: ResourceParser,
  initialProviders: ResourceProvider[],
  defaultExtension: string = '.md',
  checker: RootChecker = new DummyRootChecker()
) => {
  const workspace = await withTimingAsync(
    () =>
      FoamWorkspace.fromProviders(
        initialProviders,
        dataStore,
        defaultExtension,
        checker
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

import { IDisposable } from '../common/lifecycle';
import { IDataStore, IMatcher, IWatcher } from '../services/datastore';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { FoamTags } from './tags';
import { Logger } from '../utils/log';

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
  initialProviders: ResourceProvider[]
) => {
  const tsStart = Date.now();

  const workspace = await FoamWorkspace.fromProviders(
    initialProviders,
    dataStore
  );

  const tsWsDone = Date.now();
  Logger.info(`Workspace loaded in ${tsWsDone - tsStart}ms`);

  const graph = FoamGraph.fromWorkspace(workspace, true);
  const tsGraphDone = Date.now();
  Logger.info(`Graph loaded in ${tsGraphDone - tsWsDone}ms`);

  const tags = FoamTags.fromWorkspace(workspace, true);
  const tsTagsEnd = Date.now();
  Logger.info(`Tags loaded in ${tsTagsEnd - tsGraphDone}ms`);

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

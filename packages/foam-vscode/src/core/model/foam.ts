import { IDisposable } from '../common/lifecycle';
import { IDataStore, IMatcher } from '../services/datastore';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { createMarkdownParser } from '../services/markdown-parser';
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
  dataStore: IDataStore,
  initialProviders: ResourceProvider[]
) => {
  const parser = createMarkdownParser([]);
  const workspace = new FoamWorkspace();
  const tsStart = Date.now();

  await Promise.all(initialProviders.map(p => workspace.registerProvider(p)));
  const tsWsDone = Date.now();
  Logger.info(`Workspace loaded in ${tsWsDone - tsStart}ms`);

  const graph = FoamGraph.fromWorkspace(workspace, true, 500);
  const tsGraphDone = Date.now();
  Logger.info(`Graph loaded in ${tsGraphDone - tsWsDone}ms`);

  const tags = FoamTags.fromWorkspace(workspace, true);
  const tsTagsEnd = Date.now();
  Logger.info(`Tags loaded in ${tsTagsEnd - tsGraphDone}ms`);

  const foam: Foam = {
    workspace,
    graph,
    tags,
    services: {
      dataStore,
      parser,
      matcher,
    },
    dispose: () => {
      workspace.dispose();
      graph.dispose();
    },
  };

  return foam;
};

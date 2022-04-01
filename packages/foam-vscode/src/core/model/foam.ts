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
  const pStart = Date.now();

  await Promise.all(initialProviders.map(p => workspace.registerProvider(p)));
  const pWsEnd = Date.now();
  Logger.info(`Workspace loaded in ${pWsEnd - pStart}ms`);

  const graph = FoamGraph.fromWorkspace(workspace, true);
  const pGraphEnd = Date.now();
  Logger.info(`Graph loaded in ${pGraphEnd - pWsEnd}ms`);

  const tags = FoamTags.fromWorkspace(workspace, true);
  const pTagsEnd = Date.now();
  Logger.info(`Tags loaded in ${pTagsEnd - pGraphEnd}ms`);

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

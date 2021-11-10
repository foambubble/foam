import { IDisposable } from '../common/lifecycle';
import { IDataStore, IMatcher } from '../services/datastore';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { createMarkdownParser } from '../markdown-provider';
import { FoamTags } from './tags';

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
  await Promise.all(initialProviders.map(p => workspace.registerProvider(p)));

  const graph = FoamGraph.fromWorkspace(workspace, true);
  const tags = FoamTags.fromWorkspace(workspace, true);

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

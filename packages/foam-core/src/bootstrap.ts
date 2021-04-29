import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam, IDataStore, FoamGraph } from './index';
import { FoamWorkspace } from './model/workspace';
import { Matcher } from './services/datastore';
import { ResourceProvider } from 'model/provider';

export const bootstrap = async (
  config: FoamConfig,
  dataStore: IDataStore,
  initialProviders: ResourceProvider[]
) => {
  const parser = createMarkdownParser([]);
  const matcher = new Matcher(
    config.workspaceFolders,
    config.includeGlobs,
    config.ignoreGlobs
  );
  const workspace = new FoamWorkspace();
  const graph = FoamGraph.fromWorkspace(workspace, true);

  const foam: Foam = {
    workspace,
    graph,
    config,
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

  await Promise.all(initialProviders.map(p => workspace.registerProvider(p)));

  return foam;
};

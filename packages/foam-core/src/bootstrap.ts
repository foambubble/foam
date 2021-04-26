import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam, IDataStore, FoamGraph } from './index';
import { FoamWorkspace } from './model/workspace';
import { Matcher } from './services/datastore';

export const bootstrap = (config: FoamConfig, dataStore: IDataStore) => {
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

  return Promise.resolve(foam);
};

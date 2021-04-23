import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam, IDataStore, FoamGraph } from './index';
import { loadPlugins } from './plugins';
import { isSome } from './utils';
import { Logger } from './utils/log';
import { URI } from './model/uri';
import { FoamWorkspace } from './model/workspace';
import { Matcher, folderPlusGlob } from './services/datastore';
import glob from 'glob';
import { promisify } from 'util';

const findAllFiles = promisify(glob);

export const bootstrap = async (config: FoamConfig, dataStore: IDataStore) => {
  const plugins = await loadPlugins(config);

  const parserPlugins = plugins.map(p => p.parser).filter(isSome);
  const parser = createMarkdownParser(parserPlugins);
  const matcher = new Matcher(config);
  const workspace = new FoamWorkspace();

  const filesByFolder = await Promise.all(
    matcher.folders.map(async folder => {
      const res = await findAllFiles(folderPlusGlob(folder)('**/*'));
      return res.map(URI.file);
    })
  );
  const files = matcher.match(filesByFolder.flat());

  await Promise.all(
    files.map(async uri => {
      Logger.info('Found: ' + URI.toString(uri));
      if (URI.isMarkdownFile(uri)) {
        const content = await dataStore.read(uri);
        if (isSome(content)) {
          workspace.set(parser.parse(uri, content));
        }
      }
    })
  );
  const graph = FoamGraph.fromWorkspace(workspace, true);

  return {
    workspace: workspace,
    graph: graph,
    config: config,
    services: {
      dataStore,
      parser,
      matcher,
    },
    dispose: () => {
      workspace.dispose();
    },
  } as Foam;
};

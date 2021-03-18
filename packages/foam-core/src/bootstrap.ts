import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam, IDataStore } from './index';
import { loadPlugins } from './plugins';
import { isSome } from './utils';
import { Logger } from './utils/log';
import { isMarkdownFile } from './utils/uri';
import { FoamWorkspace } from './model/workspace';

export const bootstrap = async (config: FoamConfig, dataStore: IDataStore) => {
  const plugins = await loadPlugins(config);

  const parserPlugins = plugins.map(p => p.parser).filter(isSome);
  const parser = createMarkdownParser(parserPlugins);

  const workspace = new FoamWorkspace();
  const files = await dataStore.listFiles();
  await Promise.all(
    files.map(async uri => {
      Logger.info('Found: ' + uri);
      if (isMarkdownFile(uri)) {
        const content = await dataStore.read(uri);
        if (isSome(content)) {
          workspace.set(parser.parse(uri, content));
        }
      }
    })
  );
  workspace.resolveLinks(true);

  const listeners = [
    dataStore.onDidChange(async uri => {
      const content = await dataStore.read(uri);
      workspace.set(await parser.parse(uri, content));
    }),
    dataStore.onDidCreate(async uri => {
      const content = await dataStore.read(uri);
      workspace.set(await parser.parse(uri, content));
    }),
    dataStore.onDidDelete(uri => {
      workspace.delete(uri);
    }),
  ];

  return {
    workspace: workspace,
    config: config,
    services: {
      dataStore,
      parser,
    },
    dispose: () => {
      listeners.forEach(l => l.dispose());
      workspace.dispose();
    },
  } as Foam;
};

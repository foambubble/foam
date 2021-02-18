import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam, Services } from './index';
import { loadPlugins } from './plugins';
import { isSome } from './utils';
import { isDisposable } from './common/lifecycle';
import { Logger } from './utils/log';
import { FoamWorkspace } from './model/workspace';

export const bootstrap = async (config: FoamConfig, services: Services) => {
  const plugins = await loadPlugins(config);

  const parserPlugins = plugins.map(p => p.parser).filter(isSome);
  const parser = createMarkdownParser(parserPlugins);

  const workspace = new FoamWorkspace();
  const files = await services.dataStore.listFiles();
  await Promise.all(
    files.map(async uri => {
      Logger.info('Found: ' + uri);
      if (uri.path.endsWith('md')) {
        const content = await services.dataStore.read(uri);
        if (isSome(content)) {
          workspace.set(parser.parse(uri, content));
        }
      }
    })
  );
  workspace.resolveLinks(true);

  services.dataStore.onDidChange(async uri => {
    const content = await services.dataStore.read(uri);
    workspace.set(await parser.parse(uri, content));
  });
  services.dataStore.onDidCreate(async uri => {
    const content = await services.dataStore.read(uri);
    workspace.set(await parser.parse(uri, content));
  });
  services.dataStore.onDidDelete(uri => {
    workspace.delete(uri);
  });

  return {
    workspace: workspace,
    config: config,
    parse: parser.parse,
    services: services,
    dispose: () => {
      isDisposable(services.dataStore) && services.dataStore.dispose();
    },
  } as Foam;
};

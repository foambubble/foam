import { createGraph } from './note-graph';
import { createMarkdownParser } from './markdown-provider';
import { FoamConfig, Foam, Services } from './index';
import { loadPlugins } from './plugins';
import { isSome } from './utils';
import { isDisposable } from './common/lifecycle';

export const bootstrap = async (config: FoamConfig, services: Services) => {
  const plugins = await loadPlugins(config);

  const parserPlugins = plugins.map(p => p.parser).filter(isSome);
  const parser = createMarkdownParser(parserPlugins);

  const graphMiddlewares = plugins.map(p => p.graphMiddleware).filter(isSome);
  const graph = createGraph(graphMiddlewares);

  const files = await services.dataStore.listFiles();
  await Promise.all(
    files.map(async uri => {
      const content = await services.dataStore.read(uri);
      if (isSome(content)) {
        graph.setNote(parser.parse(uri, content));
      }
    })
  );

  services.dataStore.onDidChange(async uri => {
    const content = await services.dataStore.read(uri);
    graph.setNote(await parser.parse(uri, content));
  });
  services.dataStore.onDidCreate(async uri => {
    const content = await services.dataStore.read(uri);
    graph.setNote(await parser.parse(uri, content));
  });
  services.dataStore.onDidDelete(async uri => {
    // TODO add deleteNote to graph
  });

  return {
    notes: graph,
    config: config,
    parse: parser.parse,
    dispose: () => {
      isDisposable(services.dataStore) && services.dataStore.dispose();
    },
  } as Foam;
};

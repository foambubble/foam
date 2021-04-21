import { workspace, ExtensionContext, window } from 'vscode';
import { bootstrap, FoamConfig, Foam, Logger, FileDataStore } from 'foam-core';

import { features } from './features';
import { getConfigFromVscode } from './services/config';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';
import { isSome } from './utils';

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info('Starting Foam');

    const config: FoamConfig = getConfigFromVscode();
    const dataStore = new FileDataStore();
    const foamPromise: Promise<Foam> = bootstrap(config, dataStore);

    const resPromises = features.map(f => f.activate(context, foamPromise));

    const foam = await foamPromise;
    const { parser, matcher } = foam.services;

    Logger.info(`Loaded ${foam.workspace.list().length} notes`);

    const watcher = workspace.createFileSystemWatcher('**/*');

    context.subscriptions.push(
      foam,
      watcher,
      watcher.onDidChange(async uri => {
        if (matcher.isMatch(uri)) {
          const content = await dataStore.read(uri);
          isSome(content) &&
            foam.workspace.set(await parser.parse(uri, content));
        }
      }),
      watcher.onDidCreate(async uri => {
        if (matcher.isMatch(uri)) {
          const content = await dataStore.read(uri);
          isSome(content) &&
            foam.workspace.set(await parser.parse(uri, content));
        }
      }),
      watcher.onDidDelete(async uri => {
        matcher.isMatch(uri) && foam.workspace.delete(uri);
      })
    );

    const res = (await Promise.all(resPromises)).filter(r => r != null);

    return {
      extendMarkdownIt: (md: markdownit) => {
        return res.reduce((acc: markdownit, r: any) => {
          return r.extendMarkdownIt ? r.extendMarkdownIt(acc) : acc;
        }, md);
      },
    };
  } catch (e) {
    Logger.error('An error occurred while bootstrapping Foam', e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}

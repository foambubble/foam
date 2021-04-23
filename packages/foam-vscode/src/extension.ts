import { workspace, ExtensionContext, window } from 'vscode';
import {
  bootstrap,
  FoamConfig,
  Foam,
  Logger,
  FileDataStore,
  MarkdownResourceProvider,
  ResourceProvider,
} from 'foam-core';

import { features } from './features';
import { getConfigFromVscode } from './services/config';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';

function createMarkdownProvider(config: FoamConfig): ResourceProvider {
  const provider = new MarkdownResourceProvider(config, triggers => {
    const watcher = workspace.createFileSystemWatcher('**/*');
    return [
      watcher.onDidChange(triggers.onDidChange),
      watcher.onDidCreate(triggers.onDidCreate),
      watcher.onDidDelete(triggers.onDidDelete),
      watcher,
    ];
  });
  return provider;
}

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

    Logger.info(`Loaded ${foam.workspace.list().length} notes`);

    const markdownProvider = createMarkdownProvider(config);
    foam.workspace.registerProvider(markdownProvider);
    context.subscriptions.push(foam, markdownProvider);

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

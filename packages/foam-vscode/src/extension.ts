import { workspace, ExtensionContext, window } from 'vscode';
import {
  bootstrap,
  FoamConfig,
  Logger,
  FileDataStore,
  Matcher,
  MarkdownResourceProvider,
  ResourceProvider,
} from 'foam-core';

import { features } from './features';
import { getConfigFromVscode } from './services/config';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';

function createMarkdownProvider(config: FoamConfig): ResourceProvider {
  const matcher = new Matcher(
    config.workspaceFolders,
    config.includeGlobs,
    config.ignoreGlobs
  );
  const provider = new MarkdownResourceProvider(matcher, triggers => {
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

    // Prepare Foam
    const config: FoamConfig = getConfigFromVscode();
    const dataStore = new FileDataStore();
    const markdownProvider = createMarkdownProvider(config);
    const foamPromise = bootstrap(config, dataStore, [markdownProvider]);

    // Load the features
    const resPromises = features.map(f => f.activate(context, foamPromise));

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} notes`);
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

import { workspace, ExtensionContext, window } from 'vscode';
import {
  bootstrap,
  FoamConfig,
  Foam,
  Services,
  Logger,
  FileDataStore,
} from 'foam-core';

import { features } from './features';
import { getConfigFromVscode } from './services/config';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info('Starting Foam');

    const config: FoamConfig = getConfigFromVscode();
    const watcher = workspace.createFileSystemWatcher('**/*');
    const dataStore = new FileDataStore(config, watcher);

    const services: Services = {
      dataStore: dataStore,
    };
    const foamPromise: Promise<Foam> = bootstrap(config, services);

    features.forEach(f => {
      f.activate(context, foamPromise);
    });

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} notes`);

    context.subscriptions.push(dataStore, foam, watcher);
  } catch (e) {
    Logger.error('An error occurred while bootstrapping Foam', e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}

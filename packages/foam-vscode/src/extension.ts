"use strict";

import { workspace, ExtensionContext, window, Uri } from "vscode";
import {
  bootstrap,
  FoamConfig,
  Foam,
  Services,
  isDisposable,
  Logger
} from "foam-core";

import { features } from "./features";
import { getConfigFromVscode } from "./services/config";
import { VsCodeOutputLogger, exposeLogger } from "./services/logging";
import { VsCodeDataStore } from "./services/datastore";

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info("Starting Foam");

    const config: FoamConfig = getConfigFromVscode();
    const dataStore = new VsCodeDataStore(config);
    const services: Services = {
      dataStore: dataStore
    };
    const foamPromise: Promise<Foam> = bootstrap(config, services);

    features.forEach(f => {
      f.activate(context, foamPromise);
    });

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.notes.getNotes().length} notes`);

    context.subscriptions.push(dataStore);
  } catch (e) {
    Logger.error("An error occurred while bootstrapping Foam", e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}

"use strict";

import { workspace, ExtensionContext, window } from "vscode";

import { features } from "./features";
import { getConfigFromVscode } from "./services/config";
import { VsCodeOutputLogger, exposeLogger } from "./services/logging";
import { Foam, Services } from "./core/types";
import { Logger } from "./core/utils/log";
import { FoamConfig } from "./core/config";
import { FileDataStore } from "./core/services/datastore";
import { bootstrap } from "./core/bootstrap";

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info("Starting Foam");

    const config: FoamConfig = getConfigFromVscode();
    const dataStore = new FileDataStore(config);

    const watcher = workspace.createFileSystemWatcher("**/*");
    watcher.onDidCreate(uri => {
      if (dataStore.isMatch(uri.fsPath)) {
        dataStore.onDidCreateEmitter.fire(uri.fsPath);
      }
    });
    watcher.onDidChange(uri => {
      if (dataStore.isMatch(uri.fsPath)) {
        dataStore.onDidChangeEmitter.fire(uri.fsPath);
      }
    });
    watcher.onDidDelete(uri => {
      if (dataStore.isMatch(uri.fsPath)) {
        dataStore.onDidDeleteEmitter.fire(uri.fsPath);
      }
    });

    const services: Services = {
      dataStore: dataStore
    };
    const foamPromise: Promise<Foam> = bootstrap(config, services);

    features.forEach(f => {
      f.activate(context, foamPromise);
    });

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.notes.getNotes().length} notes`);
  } catch (e) {
    Logger.error("An error occurred while bootstrapping Foam", e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}


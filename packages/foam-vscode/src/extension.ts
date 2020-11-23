"use strict";

import { workspace, ExtensionContext, window } from "vscode";

import {
  bootstrap,
  FoamConfig,
  Foam,
  FileDataStore,
  Services,
  isDisposable
} from "foam-core";

import { features } from "./features";
import { getConfigFromVscode } from "./services/config";

let foam: Foam | null = null;

export async function activate(context: ExtensionContext) {
  try {
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
      logger: console,
      dataStore: dataStore
    };
    const foamPromise: Promise<Foam> = bootstrap(config, services);

    features.forEach(f => {
      f.activate(context, foamPromise);
    });

    foam = await foamPromise;
  } catch (e) {
    console.log("An error occurred while bootstrapping Foam", e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}

export function deactivate() {
  if (isDisposable(foam)) {
    foam?.dispose();
  }
}

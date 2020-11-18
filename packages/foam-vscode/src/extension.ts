"use strict";

import { workspace, ExtensionContext } from "vscode";

import {
  bootstrap,
  FoamConfig,
  Foam,
  FileDataStore,
  Services,
  isDisposable
} from "foam-core";

import { features } from "./features";
import { VsCodeBasedWatcher } from "./services/vscode-watcher";
import { getConfigFromVscode } from "./services/config";

let foam: Foam | null = null;

export async function activate(context: ExtensionContext) {
  try {
    const config: FoamConfig = getConfigFromVscode();
    const dataStore = new FileDataStore(
      config,
      new VsCodeBasedWatcher(workspace.createFileSystemWatcher("**/*"))
    );
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
  }
}

export function deactivate() {
  if (isDisposable(foam)) {
    foam?.dispose();
  }
}

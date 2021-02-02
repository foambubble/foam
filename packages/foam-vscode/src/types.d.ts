import { ExtensionContext } from 'vscode';
import { Foam, IDataStore } from 'foam-core';

export interface FoamExtensionContext extends ExtensionContext {
  dataStore: IDataStore;
}

export interface FoamFeature {
  activate: (context: FoamExtensionContext, foamPromise: Promise<Foam>) => void;
}

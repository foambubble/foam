import { ExtensionContext } from 'vscode';
import { Foam, FileDataStore } from 'foam-core';

export interface FoamFeature {
  activate: (
    context: ExtensionContext,
    foamPromise: Promise<Foam>,
    dataStore: FileDataStore
  ) => void;
}

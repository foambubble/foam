import { ExtensionContext } from 'vscode';
import { Foam, IDataStore } from 'foam-core';

export interface FoamFeature {
  activate: (context: ExtensionContext, foamPromise: Promise<Foam>) => void;
}

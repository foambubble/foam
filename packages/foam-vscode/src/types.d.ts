import { ExtensionContext } from 'vscode';
import { Foam } from 'foam-core';

export interface FoamFeature {
  activate: (
    context: ExtensionContext,
    foamPromise: Promise<Foam>
  ) => Promise<any> | void;
}

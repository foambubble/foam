import { Foam } from 'foam-core';
import { ExtensionContext } from 'vscode';

export interface FoamFeature {
  activate: (
    context: ExtensionContext,
    foamPromise: Promise<Foam>
  ) => Promise<any> | void;
}

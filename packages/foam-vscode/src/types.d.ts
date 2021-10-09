import { ExtensionContext } from 'vscode';
import { Foam } from './core/model/foam';

export interface FoamFeature {
  activate: (
    context: ExtensionContext,
    foamPromise: Promise<Foam>
  ) => Promise<any> | void;
}

import { ExtensionContext } from 'vscode';
import { Foam } from './core/model/foam';

export type FoamFeature = (
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) => Promise<any> | void;

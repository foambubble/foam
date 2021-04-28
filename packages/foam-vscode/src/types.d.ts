import { ExtensionContext } from 'vscode';
import { VsCodeAwareFoam } from './utils/vsc-utils';

export interface FoamFeature {
  activate: (
    context: ExtensionContext,
    foamPromise: Promise<VsCodeAwareFoam>
  ) => Promise<any> | void;
}

import { Position, Range, Uri } from 'vscode';
import {
  Foam,
  Position as FoamPosition,
  Range as FoamRange,
  Resource,
  URI as FoamURI,
  bootstrap as coreBootstrap,
} from 'foam-core';
import { VsCodeAwareFoamProvider } from '../services/provider';

export interface VsCodeAwareFoam extends Foam {
  registerProvider(provider: VsCodeAwareFoamProvider): Promise<void>;
  getResourceTooltip(resource: Resource): Promise<string>;
  getTreeItemIcon(resource: Resource): string;
}

export const create = (
  foam: Foam,
  initialProviders: VsCodeAwareFoamProvider[]
): Promise<VsCodeAwareFoam> => {
  const providers: VsCodeAwareFoamProvider[] = [];
  const res: VsCodeAwareFoam = {
    ...foam,

    registerProvider: (provider: VsCodeAwareFoamProvider): Promise<void> => {
      providers.push(provider);
      return foam.workspace.registerProvider(provider);
    },

    /**
     * Returns a VS Code compatible (markdown) string which will be used
     * as tooltip for a resource
     * @param resource the target resource
     */
    getResourceTooltip: (resource: Resource): Promise<string> => {
      const provider = providers.find(p => p.match(resource.uri));
      return provider?.getResourceTooltip(resource) ?? Promise.resolve('');
    },

    getTreeItemIcon: (resource: Resource): string => {
      const provider = providers.find(p => p.match(resource.uri));
      return provider?.getTreeItemIcon(resource) ?? 'note';
    },

    dispose: (): void => {
      foam.dispose();
    },
  };

  return Promise.all(initialProviders.map(p => res.registerProvider(p))).then(
    _ => res
  );
};

export const toVsCodePosition = (p: FoamPosition): Position =>
  new Position(p.line, p.character);

export const toVsCodeRange = (r: FoamRange): Range =>
  new Range(r.start.line, r.start.character, r.end.line, r.end.character);

export const toVsCodeUri = (u: FoamURI): Uri => Uri.parse(FoamURI.toString(u));

export const fromVsCodeUri = (u: Uri): FoamURI => FoamURI.parse(u.toString());

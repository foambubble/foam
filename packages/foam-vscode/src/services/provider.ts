import { Resource, ResourceProvider } from 'foam-core';

export interface FoamResourceProvider extends ResourceProvider {
  getNoteTooltip(resource: Resource): string;
  getTreeItemIcon(resource: Resource): string;
}

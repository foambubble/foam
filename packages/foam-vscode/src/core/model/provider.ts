import { IDisposable } from '../common/lifecycle';
import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { FoamWorkspace } from './workspace';

export interface ResourceProvider extends IDisposable {
  supports: (uri: URI) => boolean;
  readAsMarkdown: (uri: URI) => Promise<string | null>;
  fetch: (uri: URI) => Promise<Resource | null>;
  resolveLink: (
    workspace: FoamWorkspace,
    resource: Resource,
    link: ResourceLink
  ) => URI;
}

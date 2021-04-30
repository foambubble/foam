import { IDisposable } from 'common/lifecycle';
import { ResourceLink, URI } from 'index';
import { Resource } from './note';
import { FoamWorkspace } from './workspace';

export interface ResourceProvider extends IDisposable {
  init: (workspace: FoamWorkspace) => Promise<void>;
  match: (uri: URI) => boolean;
  read: (uri: URI) => Promise<string | null>;
  readAsMarkdown: (uri: URI) => Promise<string | null>;
  fetch: (uri: URI) => Promise<Resource | null>;
  resolveLink: (
    workspace: FoamWorkspace,
    resource: Resource,
    link: ResourceLink
  ) => URI;
}

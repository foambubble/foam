import { NoteLink, URI } from 'index';
import { Resource } from './note';
import { FoamWorkspace } from './workspace';

export interface ResourceProvider {
  match: (uri: URI) => boolean;
  fetch: (uri: URI) => Promise<Resource>;
  resolveLink: (
    workspace: FoamWorkspace,
    resource: Resource,
    link: NoteLink
  ) => URI;
}

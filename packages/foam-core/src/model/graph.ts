import { diff } from 'fast-array-diff';
import { isEqual } from 'lodash';
import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { IDisposable } from '../index';
import { FoamWorkspace, uriToResourceName } from './workspace';
import { Range } from './range';

export type Connection = {
  source: URI;
  target: URI;
  link: ResourceLink;
};

const pathToPlaceholderId = (value: string) => value;
const uriToPlaceholderId = (uri: URI) => pathToPlaceholderId(uri.path);

export class FoamGraph implements IDisposable {
  /**
   * Placehoders by key / slug / value
   */
  public readonly placeholders: { [key: string]: URI } = {};
  /**
   * Maps the connections starting from a URI
   */
  public readonly links: { [key: string]: Connection[] } = {};
  /**
   * Maps the connections arriving to a URI
   */
  public readonly backlinks: { [key: string]: Connection[] } = {};

  /**
   * List of disposables to destroy with the workspace
   */
  private disposables: IDisposable[] = [];

  constructor(private readonly workspace: FoamWorkspace) {}

  public contains(uri: URI): boolean {
    return this.getConnections(uri).length > 0;
  }

  public getAllNodes(): URI[] {
    return [
      ...Object.values(this.placeholders),
      ...this.workspace.list().map(r => r.uri),
    ];
  }

  public getAllConnections(): Connection[] {
    return Object.values(this.links).flat();
  }

  public getConnections(uri: URI): Connection[] {
    return [
      ...(this.links[uri.path] || []),
      ...(this.backlinks[uri.path] || []),
    ];
  }

  public getLinks(uri: URI): Connection[] {
    return this.links[uri.path] ?? [];
  }

  public getBacklinks(uri: URI): Connection[] {
    return this.backlinks[uri.path] ?? [];
  }

  /**
   * Computes all the links in the workspace, connecting notes and
   * creating placeholders.
   *
   * @param workspace the target workspace
   * @param keepMonitoring whether to recompute the links when the workspace changes
   * @returns the FoamGraph
   */
  public static fromWorkspace(
    workspace: FoamWorkspace,
    keepMonitoring: boolean = false
  ): FoamGraph {
    let graph = new FoamGraph(workspace);

    Object.values(workspace.list()).forEach(resource =>
      graph.resolveResource(resource)
    );
    if (keepMonitoring) {
      graph.disposables.push(
        workspace.onDidAdd(resource => {
          graph.updateLinksRelatedToAddedResource(resource);
        }),
        workspace.onDidUpdate(change => {
          graph.updateLinksForResource(change.old, change.new);
        }),
        workspace.onDidDelete(resource => {
          graph.updateLinksRelatedToDeletedResource(resource);
        })
      );
    }
    return graph;
  }

  private updateLinksRelatedToAddedResource(resource: Resource) {
    // check if any existing connection can be filled by new resource
    const name = uriToResourceName(resource.uri);
    if (name in this.placeholders) {
      const placeholder = this.placeholders[name];
      delete this.placeholders[name];
      const resourcesToUpdate = this.backlinks[placeholder.path] ?? [];
      resourcesToUpdate.forEach(res =>
        this.resolveResource(this.workspace.get(res.source))
      );
    }

    // resolve the resource
    this.resolveResource(resource);
  }

  private updateLinksForResource(oldResource: Resource, newResource: Resource) {
    if (oldResource.uri.path !== newResource.uri.path) {
      throw new Error(
        'Unexpected State: update should only be called on same resource ' +
          {
            old: oldResource,
            new: newResource,
          }
      );
    }
    if (oldResource.type === 'note' && newResource.type === 'note') {
      const patch = diff(oldResource.links, newResource.links, isEqual);
      patch.removed.forEach(link => {
        const target = this.workspace.resolveLink(oldResource, link);
        return this.disconnect(oldResource.uri, target, link);
      }, this);
      patch.added.forEach(link => {
        const target = this.workspace.resolveLink(newResource, link);
        return this.connect(newResource.uri, target, link);
      }, this);
    }
    return this;
  }

  private updateLinksRelatedToDeletedResource(resource: Resource) {
    const uri = resource.uri;

    // remove forward links from old resource
    const resourcesPointedByDeletedNote = this.links[uri.path] ?? [];
    delete this.links[uri.path];
    resourcesPointedByDeletedNote.forEach(connection =>
      this.disconnect(uri, connection.target, connection.link)
    );

    // recompute previous links to old resource
    const notesPointingToDeletedResource = this.backlinks[uri.path] ?? [];
    delete this.backlinks[uri.path];
    notesPointingToDeletedResource.forEach(link =>
      this.resolveResource(this.workspace.get(link.source))
    );
    return this;
  }

  private connect(source: URI, target: URI, link: ResourceLink) {
    const connection = { source, target, link };

    this.links[source.path] = this.links[source.path] ?? [];
    this.links[source.path].push(connection);
    this.backlinks[target.path] = this.backlinks[target.path] ?? [];
    this.backlinks[target.path].push(connection);

    if (URI.isPlaceholder(target)) {
      this.placeholders[uriToPlaceholderId(target)] = target;
    }
    return this;
  }

  /**
   * Removes a connection, or all connections, between the source and
   * target resources
   *
   * @param workspace the Foam workspace
   * @param source the source resource
   * @param target the target resource
   * @param link the link reference, or `true` to remove all links
   * @returns the updated Foam workspace
   */
  private disconnect(source: URI, target: URI, link: ResourceLink | true) {
    const connectionsToKeep =
      link === true
        ? (c: Connection) =>
            !URI.isEqual(source, c.source) || !URI.isEqual(target, c.target)
        : (c: Connection) => !isSameConnection({ source, target, link }, c);

    this.links[source.path] =
      this.links[source.path]?.filter(connectionsToKeep) ?? [];
    if (this.links[source.path].length === 0) {
      delete this.links[source.path];
    }
    this.backlinks[target.path] =
      this.backlinks[target.path]?.filter(connectionsToKeep) ?? [];
    if (this.backlinks[target.path].length === 0) {
      delete this.backlinks[target.path];
      if (URI.isPlaceholder(target)) {
        delete this.placeholders[uriToPlaceholderId(target)];
      }
    }
    return this;
  }

  public resolveResource(resource: Resource) {
    delete this.links[resource.uri.path];
    // prettier-ignore
    resource.links.forEach(link => {
      const targetUri = this.workspace.resolveLink(resource, link);
      this.connect(resource.uri, targetUri, link);
    });
    return this;
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

// TODO move these utility fns to appropriate places

const isSameConnection = (a: Connection, b: Connection) =>
  URI.isEqual(a.source, b.source) &&
  URI.isEqual(a.target, b.target) &&
  isSameLink(a.link, b.link);

const isSameLink = (a: ResourceLink, b: ResourceLink) =>
  a.type === b.type && Range.isEqual(a.range, b.range);

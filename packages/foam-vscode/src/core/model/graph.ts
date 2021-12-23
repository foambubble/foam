import { diff } from 'fast-array-diff';
import { isEqual } from 'lodash';
import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { FoamWorkspace } from './workspace';
import { Range } from './range';
import { IDisposable } from '../common/lifecycle';

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
  public readonly placeholders: Map<string, URI> = new Map();
  /**
   * Maps the connections starting from a URI
   */
  public readonly links: Map<string, Connection[]> = new Map();
  /**
   * Maps the connections arriving to a URI
   */
  public readonly backlinks: Map<string, Connection[]> = new Map();

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
      ...Array.from(this.placeholders.values()),
      ...this.workspace.list().map(r => r.uri),
    ];
  }

  public getAllConnections(): Connection[] {
    return Array.from(this.links.values()).flat();
  }

  public getConnections(uri: URI): Connection[] {
    return [
      ...(this.links.get(uri.path) || []),
      ...(this.backlinks.get(uri.path) || []),
    ];
  }

  public getLinks(uri: URI): Connection[] {
    return this.links.get(uri.path) ?? [];
  }

  public getBacklinks(uri: URI): Connection[] {
    return this.backlinks.get(uri.path) ?? [];
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
    keepMonitoring = false
  ): FoamGraph {
    const graph = new FoamGraph(workspace);

    workspace.list().forEach(resource => graph.resolveResource(resource));
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
    const resourcesToUpdate: URI[] = [];
    for (const placeholderId of this.placeholders.keys()) {
      // quick and dirty check for affected resources
      if (resource.uri.path.endsWith(placeholderId + '.md')) {
        resourcesToUpdate.push(
          ...this.backlinks.get(placeholderId).map(c => c.source)
        );
        // resourcesToUpdate.push(resource);
      }
    }
    resourcesToUpdate.forEach(res =>
      this.resolveResource(this.workspace.get(res))
    );
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
    const resourcesPointedByDeletedNote = this.links.get(uri.path) ?? [];
    this.links.delete(uri.path);
    resourcesPointedByDeletedNote.forEach(connection =>
      this.disconnect(uri, connection.target, connection.link)
    );

    // recompute previous links to old resource
    const notesPointingToDeletedResource = this.backlinks.get(uri.path) ?? [];
    this.backlinks.delete(uri.path);
    notesPointingToDeletedResource.forEach(link =>
      this.resolveResource(this.workspace.get(link.source))
    );
    return this;
  }

  private connect(source: URI, target: URI, link: ResourceLink) {
    const connection = { source, target, link };

    if (!this.links.has(source.path)) {
      this.links.set(source.path, []);
    }
    this.links.get(source.path)?.push(connection);

    if (!this.backlinks.get(target.path)) {
      this.backlinks.set(target.path, []);
    }

    this.backlinks.get(target.path)?.push(connection);

    if (target.isPlaceholder()) {
      this.placeholders.set(uriToPlaceholderId(target), target);
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
            !source.isEqual(c.source) || !target.isEqual(c.target)
        : (c: Connection) => !isSameConnection({ source, target, link }, c);

    this.links.set(
      source.path,
      this.links.get(source.path)?.filter(connectionsToKeep) ?? []
    );
    if (this.links.get(source.path)?.length === 0) {
      this.links.delete(source.path);
    }
    this.backlinks.set(
      target.path,
      this.backlinks.get(target.path)?.filter(connectionsToKeep) ?? []
    );
    if (this.backlinks.get(target.path)?.length === 0) {
      this.backlinks.delete(target.path);
      if (target.isPlaceholder()) {
        this.placeholders.delete(uriToPlaceholderId(target));
      }
    }
    return this;
  }

  public resolveResource(resource: Resource) {
    this.links.delete(resource.uri.path);
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
  a.source.isEqual(b.source) &&
  a.target.isEqual(b.target) &&
  isSameLink(a.link, b.link);

const isSameLink = (a: ResourceLink, b: ResourceLink) =>
  a.type === b.type && Range.isEqual(a.range, b.range);

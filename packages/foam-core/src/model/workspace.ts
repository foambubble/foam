import { diff } from 'fast-array-diff';
import { isEqual } from 'lodash';
import * as path from 'path';
import { Resource, NoteLink, isNote } from './note';
import { Range } from './range';
import { URI } from './uri';
import { isSome, isNone } from '../utils';
import { Emitter } from '../common/event';
import { IDisposable } from '../index';

export type Connection = {
  source: URI;
  target: URI;
  link: NoteLink;
};

export function getReferenceType(
  reference: URI | string
): 'uri' | 'absolute-path' | 'relative-path' | 'key' {
  if (URI.isUri(reference)) {
    return 'uri';
  }
  const isPath = reference.split('/').length > 1;
  if (!isPath) {
    return 'key';
  }
  const isAbsPath = isPath && reference.startsWith('/');
  return isAbsPath ? 'absolute-path' : 'relative-path';
}

const pathToResourceId = (pathValue: string) => {
  const { ext } = path.parse(pathValue);
  return ext.length > 0 ? pathValue : pathValue + '.md';
};
const uriToResourceId = (uri: URI) => pathToResourceId(uri.path);

const pathToResourceName = (pathValue: string) => path.parse(pathValue).name;
const uriToResourceName = (uri: URI) => pathToResourceName(uri.path);

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

  private connect(source: URI, target: URI, link: NoteLink) {
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
  private disconnect(source: URI, target: URI, link: NoteLink | true) {
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
    const links = isNote(resource) ? resource.links : []
    links.forEach(link => {
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

export class FoamWorkspace implements IDisposable {
  private onDidAddEmitter = new Emitter<Resource>();
  private onDidUpdateEmitter = new Emitter<{ old: Resource; new: Resource }>();
  private onDidDeleteEmitter = new Emitter<Resource>();
  onDidAdd = this.onDidAddEmitter.event;
  onDidUpdate = this.onDidUpdateEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  /**
   * Resources by key / slug
   */
  private resourcesByName: { [key: string]: string[] } = {};
  /**
   * Resources by URI
   */
  private resources: { [key: string]: Resource } = {};

  set(resource: Resource) {
    const id = uriToResourceId(resource.uri);
    const old = this.find(resource.uri);
    const name = uriToResourceName(resource.uri);
    this.resources[id] = resource;
    this.resourcesByName[name] = this.resourcesByName[name] ?? [];
    this.resourcesByName[name].push(id);
    isSome(old)
      ? this.onDidUpdateEmitter.fire({ old: old, new: resource })
      : this.onDidAddEmitter.fire(resource);
    return this;
  }

  delete(uri: URI) {
    const id = uriToResourceId(uri);
    const deleted = this.resources[id];
    delete this.resources[id];

    const name = uriToResourceName(uri);
    this.resourcesByName[name] =
      this.resourcesByName[name]?.filter(resId => resId !== id) ?? [];
    if (this.resourcesByName[name].length === 0) {
      delete this.resourcesByName[name];
    }

    isSome(deleted) && this.onDidDeleteEmitter.fire(deleted);
    return deleted ?? null;
  }

  public exists(uri: URI): boolean {
    return (
      !URI.isPlaceholder(uri) && isSome(this.resources[uriToResourceId(uri)])
    );
  }

  public list(): Resource[] {
    return Object.values(this.resources);
  }

  public get(uri: URI): Resource {
    const note = this.find(uri);
    if (isSome(note)) {
      return note;
    } else {
      throw new Error('Resource not found: ' + uri.path);
    }
  }

  public find(resourceId: URI | string, reference?: URI): Resource | null {
    const refType = getReferenceType(resourceId);
    switch (refType) {
      case 'uri':
        const uri = resourceId as URI;
        return this.exists(uri) ? this.resources[uriToResourceId(uri)] : null;

      case 'key':
        const name = pathToResourceName(resourceId as string);
        const paths = this.resourcesByName[name];
        if (isNone(paths) || paths.length === 0) {
          return null;
        }
        // prettier-ignore
        const sortedPaths = paths.length === 1
          ? paths
          : paths.sort((a, b) => a.localeCompare(b));
        return this.resources[sortedPaths[0]];

      case 'absolute-path':
        const resourceUri = URI.file(resourceId as string);
        return this.resources[uriToResourceId(resourceUri)] ?? null;

      case 'relative-path':
        if (isNone(reference)) {
          return null;
        }
        const relativePath = resourceId as string;
        const targetUri = URI.computeRelativeURI(reference, relativePath);
        return this.resources[uriToResourceId(targetUri)] ?? null;

      default:
        throw new Error('Unexpected reference type: ' + refType);
    }
  }

  /**
   * Computes all the links in the workspace, connecting notes and
   * creating placeholders.
   *
   * @param workspace the target workspace
   * @param keepMonitoring whether to recompute the links when the workspace changes
   * @returns the resolved workspace
   */
  public resolveLinks(keepMonitoring: boolean = false): FoamGraph {
    return FoamGraph.fromWorkspace(this, keepMonitoring);
  }

  public resolveLink(resource: Resource, link: NoteLink): URI {
    let targetUri: URI | undefined;
    switch (link.type) {
      case 'wikilink':
        const definitionUri = isNote(resource)
          ? resource.definitions.find(def => def.label === link.slug)?.url
          : null;
        if (isSome(definitionUri)) {
          const definedUri = URI.resolve(definitionUri, resource.uri);
          targetUri =
            this.find(definedUri, resource.uri)?.uri ??
            URI.placeholder(definedUri.path);
        } else {
          targetUri =
            this.find(link.slug, resource.uri)?.uri ??
            URI.placeholder(link.slug);
        }
        break;

      case 'link':
        targetUri =
          this.find(link.target, resource.uri)?.uri ??
          URI.placeholder(URI.resolve(link.target, resource.uri).path);
        break;
    }
    return targetUri;
  }

  public dispose(): void {
    this.onDidAddEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this.onDidUpdateEmitter.dispose();
  }
}

// TODO move these utility fns to appropriate places

const isSameConnection = (a: Connection, b: Connection) =>
  URI.isEqual(a.source, b.source) &&
  URI.isEqual(a.target, b.target) &&
  isSameLink(a.link, b.link);

const isSameLink = (a: NoteLink, b: NoteLink) =>
  a.type === b.type && Range.isEqual(a.range, b.range);

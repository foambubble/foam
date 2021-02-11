import { diff } from 'fast-array-diff';
import { isEqual } from 'lodash';
import * as path from 'path';
import { URI } from '../common/uri';
import { Resource, NoteLink, Note } from '../model/note';
import {
  computeRelativeURI,
  isSome,
  isNone,
  parseUri,
  placeholderUri,
  isPlaceholder,
} from '../utils';
import { Emitter } from '../common/event';
import { IDisposable } from '../index';

export type Connection = {
  source: URI;
  target: URI;
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

function normalizePath(pathValue: string) {
  const { ext } = path.parse(pathValue);
  return ext.length > 0 ? pathValue : pathValue + '.md';
}

function normalizeKey(pathValue: string) {
  return path.parse(pathValue).name;
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
  /**
   * Placehoders by key / slug / value
   */
  private placeholders: { [key: string]: Resource } = {};

  /**
   * Maps the connections starting from a URI
   */
  private links: { [key: string]: Connection[] } = {};
  /**
   * Maps the connections arriving to a URI
   */
  private backlinks: { [key: string]: Connection[] } = {};
  /**
   * List of disposables to destroy with the workspace
   */
  disposables: IDisposable[] = [];

  exists(uri: URI) {
    return FoamWorkspace.exists(this, uri);
  }
  list() {
    return FoamWorkspace.list(this);
  }
  get(uri: URI) {
    return FoamWorkspace.get(this, uri);
  }
  find(uri: URI) {
    return FoamWorkspace.find(this, uri);
  }
  set(resource: Resource) {
    return FoamWorkspace.set(this, resource);
  }
  delete(uri: URI) {
    return FoamWorkspace.delete(this, uri);
  }

  resolveLink(note: Note, link: NoteLink) {
    return FoamWorkspace.resolveLink(this, note, link);
  }
  resolveLinks(keepMonitoring: boolean = false) {
    return FoamWorkspace.resolveLinks(this, keepMonitoring);
  }
  getAllConnections() {
    return FoamWorkspace.getAllConnections(this);
  }
  getConnections(uri: URI) {
    return FoamWorkspace.getConnections(this, uri);
  }
  getLinks(uri: URI) {
    return FoamWorkspace.getLinks(this, uri);
  }
  getBacklinks(uri: URI) {
    return FoamWorkspace.getBacklinks(this, uri);
  }

  dispose(): void {
    this.onDidAddEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this.onDidUpdateEmitter.dispose();
    this.disposables.forEach(d => d.dispose());
  }

  public static resolveLink(
    workspace: FoamWorkspace,
    note: Note,
    link: NoteLink
  ): URI {
    let targetUri: URI | null = null;
    switch (link.type) {
      case 'wikilink':
        const definitionUri = note.definitions.find(
          def => def.label === link.slug
        )?.url;
        if (isSome(definitionUri)) {
          targetUri = parseUri(note.uri, definitionUri!);
        } else {
          targetUri =
            FoamWorkspace.find(workspace, link.slug, note.uri)?.uri ??
            placeholderUri(link.slug);
        }
        break;

      case 'link':
        targetUri =
          FoamWorkspace.find(workspace, link.target, note.uri)?.uri ??
          placeholderUri(link.target);
        break;
    }

    if (isPlaceholder(targetUri)) {
      // we can only add placeholders when links are being resolved
      workspace = FoamWorkspace.set(workspace, {
        type: 'placeholder',
        uri: targetUri,
      });
    }
    return targetUri;
  }

  /**
   * Computes all the links in the workspace, connecting notes and
   * creating placeholders.
   *
   * @param workspace the target workspace
   * @param keepMonitoring whether to recompute the links when the workspace changes
   * @returns the resolved workspace
   */
  public static resolveLinks(
    workspace: FoamWorkspace,
    keepMonitoring: boolean = false
  ): FoamWorkspace {
    workspace.links = {};
    workspace.backlinks = {};
    workspace.placeholders = {};

    workspace = Object.values(workspace.list()).reduce(
      (w, resource) => FoamWorkspace.resolveResource(w, resource),
      workspace
    );
    if (keepMonitoring) {
      workspace.disposables.push(
        workspace.onDidAdd(resource => {
          FoamWorkspace.resolveResource(workspace, resource);
        }),
        workspace.onDidUpdate(change => {
          FoamWorkspace.updateLinksForResource(
            workspace,
            change.old,
            change.new
          );
        }),
        workspace.onDidDelete(resource => {
          FoamWorkspace.deleteLinksForResource(workspace, resource.uri);
        })
      );
    }
    return workspace;
  }

  public static getAllConnections(workspace: FoamWorkspace): Connection[] {
    return Object.values(workspace.links).flat();
  }

  public static getConnections(
    workspace: FoamWorkspace,
    uri: URI
  ): Connection[] {
    return [
      ...(workspace.links[uri.path] || []),
      ...(workspace.backlinks[uri.path] || []),
    ];
  }

  public static getLinks(workspace: FoamWorkspace, uri: URI): URI[] {
    return workspace.links[uri.path]?.map(c => c.target) ?? [];
  }

  public static getBacklinks(workspace: FoamWorkspace, uri: URI): URI[] {
    return workspace.backlinks[uri.path]?.map(c => c.source) ?? [];
  }

  public static set(
    workspace: FoamWorkspace,
    resource: Resource
  ): FoamWorkspace {
    if (resource.type === 'placeholder') {
      workspace.placeholders[resource.uri.path] = resource;
      return workspace;
    }
    const old = FoamWorkspace.find(workspace, resource.uri);
    workspace.resources[resource.uri.path] = resource;
    const name = normalizeKey(resource.uri.path);
    workspace.resourcesByName[name] = workspace.resourcesByName[name] ?? [];
    workspace.resourcesByName[name].push(resource.uri.path);
    isSome(old)
      ? workspace.onDidUpdateEmitter.fire({ old: old, new: resource })
      : workspace.onDidAddEmitter.fire(resource);
    return workspace;
  }

  public static exists(workspace: FoamWorkspace, uri: URI): boolean {
    return isSome(workspace.resources[uri.path]);
  }

  public static list(workspace: FoamWorkspace): Resource[] {
    return [
      ...Object.values(workspace.resources),
      ...Object.values(workspace.placeholders),
    ];
  }

  public static get(workspace: FoamWorkspace, uri: URI): Resource {
    const note = FoamWorkspace.find(workspace, uri);
    if (isSome(note)) {
      return note;
    } else {
      throw new Error('Resource not found: ' + uri.path);
    }
  }

  public static find(
    workspace: FoamWorkspace,
    resourceId: URI | string,
    reference?: URI
  ): Resource | null {
    const refType = getReferenceType(resourceId);
    switch (refType) {
      case 'uri':
        const uri = resourceId as URI;
        if (uri.scheme === 'placeholder') {
          return uri.path in workspace.placeholders
            ? { type: 'placeholder', uri: uri }
            : null;
        } else {
          return FoamWorkspace.exists(workspace, uri)
            ? workspace.resources[uri.path]
            : null;
        }

      case 'key':
        const key = normalizeKey(resourceId as string);
        const paths = workspace.resourcesByName[key];
        if (isNone(paths) || paths.length === 0) {
          return workspace.placeholders[key] ?? null;
        }
        // prettier-ignore
        const sortedPaths = paths.length === 1
          ? paths
          : paths.sort((a, b) => a.localeCompare(b));
        return workspace.resources[sortedPaths[0]];

      case 'absolute-path':
        const path = normalizePath(resourceId as string);
        return workspace.resources[path] ?? workspace.placeholders[path];

      case 'relative-path':
        if (isNone(reference)) {
          throw new Error(
            'Cannot find note defined by relative path without reference note: ' +
              resourceId
          );
        }
        const relativePath = resourceId as string;
        const targetUri = computeRelativeURI(reference, relativePath);
        return (
          workspace.resources[targetUri.path] ??
          workspace.placeholders[relativePath]
        );

      default:
        throw new Error('Unexpected reference type: ' + refType);
    }
  }

  public static delete(workspace: FoamWorkspace, uri: URI): Resource | null {
    const deleted = workspace.resources[uri.path];
    delete workspace.resources[uri.path];
    isSome(deleted) && workspace.onDidDeleteEmitter.fire(deleted);
    return deleted ?? null;
  }

  public static resolveResource(workspace: FoamWorkspace, resource: Resource) {
    // prettier-ignore
    resource.type === 'note' && resource.links.forEach(link => {
      const targetUri = FoamWorkspace.resolveLink(workspace, resource, link)
      workspace = FoamWorkspace.connect(workspace, resource.uri, targetUri)
    });
    return workspace;
  }

  private static updateLinksForResource(
    workspace: FoamWorkspace,
    oldResource: Resource,
    newResource: Resource
  ) {
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
      workspace = patch.removed.reduce((g, link) => {
        const target = workspace.resolveLink(oldResource, link);
        return FoamWorkspace.disconnect(g, oldResource.uri, target);
      }, workspace);
      workspace = patch.added.reduce((g, link) => {
        const target = workspace.resolveLink(newResource, link);
        return FoamWorkspace.connect(g, newResource.uri, target);
      }, workspace);
    }
    return workspace;
  }

  private static deleteLinksForResource(workspace: FoamWorkspace, uri: URI) {
    delete workspace.links[uri.path];
    // we rebuild the backlinks by resolving any link that was pointing to the deleted resource
    const toCheck = workspace.backlinks[uri.path];
    delete workspace.backlinks[uri.path];

    toCheck.forEach(link => {
      const source = workspace.get(link.source);
      source.type === 'note' &&
        source.links.forEach(l => {
          const targetUri = FoamWorkspace.resolveLink(workspace, source, l);
          workspace = FoamWorkspace.connect(workspace, uri, targetUri);
        });
    });
  }

  private static connect(workspace: FoamWorkspace, source: URI, target: URI) {
    const connection = {
      source: source,
      target: target,
    };

    workspace.links[source.path] = workspace.links[source.path] ?? [];
    workspace.links[source.path].push(connection);
    workspace.backlinks[target.path] = workspace.backlinks[target.path] ?? [];
    workspace.backlinks[target.path].push(connection);

    return workspace;
  }

  private static disconnect(
    workspace: FoamWorkspace,
    source: URI,
    target: URI
  ) {
    workspace.links[source.path] = workspace.links[source.path]?.filter(
      c => c.source.path === source.path && c.target.path === target.path
    );
    workspace.backlinks[target.path] = workspace.backlinks[target.path]?.filter(
      c => c.source.path === source.path && c.target.path === target.path
    );
    return workspace;
  }
}

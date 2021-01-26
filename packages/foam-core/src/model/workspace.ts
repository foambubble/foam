import * as path from 'path';
import { URI } from '../common/uri';
import { Resource, NoteLink, Note } from '../model/note';
import {
  computeRelativeURI,
  isSome,
  isNone,
  parseUri,
  placeholderUri,
} from '../utils';
import { Event, Emitter } from '../common/event';
import { Connection, FoamGraph, createFromWorkspace } from './graph';
import { IDisposable } from 'index';

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

  private resourcesByName: { [key: string]: string[] } = {}; // resource basename => resource uri
  private resources: { [key: string]: Resource } = {};
  private graph: FoamGraph = new FoamGraph();

  resolveLink = FoamWorkspace.resolveLink.bind(null, this);
  resolveLinks = FoamWorkspace.resolveLinks.bind(null, this);
  getLinks = FoamWorkspace.getLinks.bind(null, this);
  getBacklinks = FoamWorkspace.getBacklinks.bind(null, this);
  getConnections = FoamWorkspace.getConnections.bind(null, this);
  set = FoamWorkspace.set.bind(null, this);
  exists = FoamWorkspace.exists.bind(null, this);
  list = FoamWorkspace.list.bind(null, this);
  get = FoamWorkspace.get.bind(null, this);
  find = FoamWorkspace.find.bind(null, this);
  delete = FoamWorkspace.delete.bind(null, this);

  dispose(): void {
    this.onDidAddEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this.onDidUpdateEmitter.dispose();
    this.graph.dispose();
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
          targetUri = parseUri(note.uri, definitionUri);
        } else {
          targetUri =
            FoamWorkspace.find(workspace, link.slug, note.uri)?.uri ??
            placeholderUri(link.slug);
        }
        break;

      case 'link':
        targetUri = parseUri(note.uri, link.target);
        break;
    }
    return targetUri;
  }

  public static resolveLinks(
    workspace: FoamWorkspace,
    keepMonitoring: boolean = false
  ): FoamWorkspace {
    const graph = createFromWorkspace(workspace, keepMonitoring);
    workspace.graph.dispose();
    workspace.graph = graph;
    return workspace;
  }

  public static getConnections(
    workspace: FoamWorkspace,
    uri: URI
  ): Connection[] {
    return FoamGraph.getConnections(workspace.graph, uri);
  }

  public static getLinks(workspace: FoamWorkspace, uri: URI): URI[] {
    return FoamGraph.getLinks(workspace.graph, uri);
  }

  public static getBacklinks(workspace: FoamWorkspace, uri: URI): URI[] {
    return FoamGraph.getBacklinks(workspace.graph, uri);
  }

  public static set(
    workspace: FoamWorkspace,
    resource: Resource
  ): FoamWorkspace {
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
    return Object.values(workspace.resources);
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
        return FoamWorkspace.exists(workspace, uri)
          ? workspace.resources[uri.path]
          : null;

      case 'key':
        const key = normalizeKey(resourceId as string);
        const paths = workspace.resourcesByName[key];
        if (isNone(paths) || paths.length === 0) {
          return null;
        }
        // prettier-ignore
        const sortedPaths = paths.length === 1
          ? paths
          : paths.sort((a, b) => a.localeCompare(b));
        return workspace.resources[sortedPaths[0]];

      case 'absolute-path':
        const path = normalizePath(resourceId as string);
        return workspace.resources[path];

      case 'relative-path':
        if (isNone(reference)) {
          throw new Error(
            'Cannot find note defined by relative path without reference note: ' +
              resourceId
          );
        }
        const relativePath = resourceId as string;
        const targetUri = computeRelativeURI(reference, relativePath);
        return workspace.resources[targetUri.path];

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
}

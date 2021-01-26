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
// import { Event, Emitter } from '../common/event';

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

export type Connection = {
  source: URI;
  target: URI;
};

export class FoamWorkspace {
  private resourcesByName: { [key: string]: string[] }; // resource basename => resource uri
  private resources: { [key: string]: Resource };

  private links: { [key: string]: Connection[] }; // source uri => target uri
  private backlinks: { [key: string]: Connection[] }; // target uri => source uri

  constructor() {
    this.resources = {};
    this.resourcesByName = {};
    this.links = {};
    this.backlinks = {};
  }

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

  public static resolveLink(
    workspace: FoamWorkspace,
    note: Note,
    link: NoteLink
  ) {
    let targetUri: URI | null = null;
    switch (link.type) {
      case 'wikilink':
        const definitionUri = note.definitions.find(
          def => def.label === link.slug
        )?.url;
        if (isSome(definitionUri)) {
          targetUri = computeRelativeURI(note.uri, definitionUri);
        } else {
          targetUri =
            FoamWorkspace.find(workspace, link.slug, note.uri)?.uri ?? null;
        }
        break;

      case 'link':
        targetUri = parseUri(note.uri, link.target);
        break;
    }
    return targetUri;
  }

  public static resolveLinks(workspace: FoamWorkspace): FoamWorkspace {
    workspace.links = {};
    workspace.backlinks = {};
    Object.values(workspace.resources).forEach(note => {
      // prettier-ignore
      note.type === 'note' && note.links.forEach(link => {
        const targetUri =
          FoamWorkspace.resolveLink(workspace, note, link) ??
          placeholderUri(link.target);

        const source = note.uri.path;
        const target = targetUri.path;

        const connection = {
          source: note.uri,
          target: targetUri,
        };

        workspace.links[source] = workspace.links[source] ?? [];
        workspace.links[source].push(connection);
        workspace.backlinks[target] = workspace.backlinks[target] ?? [];
        workspace.backlinks[target].push(connection);
      });
    });
    return workspace;
  }

  public static getConnections(
    workspace: FoamWorkspace,
    uri: URI
  ): Connection[] {
    return [...workspace.links[uri.path], ...workspace.backlinks[uri.path]];
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
    workspace.resources[resource.uri.path] = resource;
    const name = normalizeKey(resource.uri.path);
    workspace.resourcesByName[name] = workspace.resourcesByName[name] ?? [];
    workspace.resourcesByName[name].push(resource.uri.path);
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
    return deleted ?? null;
  }
}

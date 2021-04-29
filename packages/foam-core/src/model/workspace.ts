import * as path from 'path';
import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { isSome, isNone } from '../utils';
import { Emitter } from '../common/event';
import { IDisposable } from '../index';
import { ResourceProvider } from './provider';

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
export const uriToResourceName = (uri: URI) => pathToResourceName(uri.path);

export class FoamWorkspace implements IDisposable {
  private onDidAddEmitter = new Emitter<Resource>();
  private onDidUpdateEmitter = new Emitter<{ old: Resource; new: Resource }>();
  private onDidDeleteEmitter = new Emitter<Resource>();
  onDidAdd = this.onDidAddEmitter.event;
  onDidUpdate = this.onDidUpdateEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  private providers: ResourceProvider[] = [];

  /**
   * Resources by key / slug
   */
  private resourcesByName: { [key: string]: string[] } = {};
  /**
   * Resources by URI
   */
  private resources: { [key: string]: Resource } = {};

  registerProvider(provider: ResourceProvider) {
    this.providers.push(provider);
    return provider.init(this);
  }

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

  public resolveLink(resource: Resource, link: ResourceLink): URI {
    // TODO add tests
    const provider = this.providers.find(p => p.match(resource.uri));
    return (
      provider?.resolveLink(this, resource, link) ??
      URI.placeholder(link.target)
    );
  }

  public read(uri: URI): Promise<string | null> {
    const provider = this.providers.find(p => p.match(uri));
    return provider?.read(uri) ?? Promise.resolve(null);
  }

  public readAsMarkdown(uri: URI): Promise<string | null> {
    const provider = this.providers.find(p => p.match(uri));
    return provider?.readAsMarkdown(uri) ?? Promise.resolve(null);
  }

  public dispose(): void {
    this.onDidAddEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this.onDidUpdateEmitter.dispose();
  }
}

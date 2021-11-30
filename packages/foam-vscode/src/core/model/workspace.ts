import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { isSome, isNone, getShortestIdentifier } from '../utils';
import { Emitter } from '../common/event';
import { ResourceProvider } from './provider';
import { IDisposable } from '../common/lifecycle';

export function getReferenceType(
  reference: URI | string
): 'uri' | 'absolute-path' | 'relative-path' | 'key' {
  if (URI.isUri(reference)) {
    return 'uri';
  }
  if (reference.startsWith('/')) {
    return 'absolute-path';
  }
  if (reference.startsWith('./') || reference.startsWith('../')) {
    return 'relative-path';
  }
  return 'key';
}

function hasExtension(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  return dotIdx > 0 && path.length - dotIdx <= 4;
}

export class FoamWorkspace implements IDisposable {
  private onDidAddEmitter = new Emitter<Resource>();
  private onDidUpdateEmitter = new Emitter<{ old: Resource; new: Resource }>();
  private onDidDeleteEmitter = new Emitter<Resource>();
  onDidAdd = this.onDidAddEmitter.event;
  onDidUpdate = this.onDidUpdateEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  private providers: ResourceProvider[] = [];

  /**
   * Resources by path
   */
  private resources: Map<string, Resource> = new Map();

  registerProvider(provider: ResourceProvider) {
    this.providers.push(provider);
    return provider.init(this);
  }

  set(resource: Resource) {
    const old = this.find(resource.uri);
    this.resources.set(normalize(resource.uri.path), resource);
    isSome(old)
      ? this.onDidUpdateEmitter.fire({ old: old, new: resource })
      : this.onDidAddEmitter.fire(resource);
    return this;
  }

  delete(uri: URI) {
    const deleted = this.resources.get(normalize(uri.path));
    this.resources.delete(normalize(uri.path));

    isSome(deleted) && this.onDidDeleteEmitter.fire(deleted);
    return deleted ?? null;
  }

  public exists(uri: URI): boolean {
    return (
      !URI.isPlaceholder(uri) && isSome(this.resources.get(normalize(uri.path)))
    );
  }

  public list(): Resource[] {
    return Array.from(this.resources.values());
  }

  public get(uri: URI): Resource {
    const note = this.find(uri);
    if (isSome(note)) {
      return note;
    } else {
      throw new Error('Resource not found: ' + uri.path);
    }
  }

  public listById(resourceId: string): Resource[] {
    let needle = '/' + resourceId;
    if (!hasExtension(needle)) {
      needle = needle + '.md';
    }
    needle = normalize(needle);
    let resources = [];
    for (const key of this.resources.keys()) {
      if (key.endsWith(needle)) {
        resources.push(this.resources.get(normalize(key)));
      }
    }
    return resources;
  }

  /**
   * Returns the minimal identifier for the given resource
   *
   * @param forResource the resource to compute the identifier for
   */
  public getIdentifier(forResource: URI): string {
    const amongst = [];
    const base = forResource.path.split('/').pop();
    for (const res of this.resources.values()) {
      // Just a quick optimization to only add the elements that might match
      if (res.uri.path.endsWith(base)) {
        if (!URI.isEqual(res.uri, forResource)) {
          amongst.push(res.uri);
        }
      }
    }
    const identifier = getShortestIdentifier(
      forResource.path,
      amongst.map(uri => uri.path)
    );

    return identifier.endsWith('.md') ? identifier.slice(0, -3) : identifier;
  }

  public find(resourceId: URI | string, reference?: URI): Resource | null {
    const refType = getReferenceType(resourceId);
    switch (refType) {
      case 'uri':
        const uri = resourceId as URI;
        return this.exists(uri)
          ? this.resources.get(normalize(uri.path)) ?? null
          : null;

      case 'key':
        const resources = this.listById(resourceId as string);
        const sorted = resources.sort((a, b) =>
          a.uri.path.localeCompare(b.uri.path)
        );
        return sorted[0] ?? null;

      case 'absolute-path':
        if (!hasExtension(resourceId as string)) {
          resourceId = resourceId + '.md';
        }
        const resourceUri = URI.file(resourceId as string);
        return this.resources.get(normalize(resourceUri.path)) ?? null;

      case 'relative-path':
        if (isNone(reference)) {
          return null;
        }
        if (!hasExtension(resourceId as string)) {
          resourceId = resourceId + '.md';
        }
        const relativePath = resourceId as string;
        const targetUri = URI.computeRelativeURI(reference, relativePath);
        return this.resources.get(normalize(targetUri.path)) ?? null;

      default:
        throw new Error('Unexpected reference type: ' + refType);
    }
  }

  public resolveLink(resource: Resource, link: ResourceLink): URI {
    // TODO add tests
    const provider = this.providers.find(p => p.supports(resource.uri));
    return (
      provider?.resolveLink(this, resource, link) ??
      URI.placeholder(link.target)
    );
  }

  public read(uri: URI): Promise<string | null> {
    const provider = this.providers.find(p => p.supports(uri));
    return provider?.read(uri) ?? Promise.resolve(null);
  }

  public readAsMarkdown(uri: URI): Promise<string | null> {
    const provider = this.providers.find(p => p.supports(uri));
    return provider?.readAsMarkdown(uri) ?? Promise.resolve(null);
  }

  public dispose(): void {
    this.onDidAddEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this.onDidUpdateEmitter.dispose();
  }
}

const normalize = (v: string) => v.toLocaleLowerCase();

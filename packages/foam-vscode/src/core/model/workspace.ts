import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { isPath, isAbsolute, getExtension } from '../utils/path';
import { isSome, getShortestIdentifier } from '../utils';
import { Emitter } from '../common/event';
import { ResourceProvider } from './provider';
import { IDisposable } from '../common/lifecycle';

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
    return isSome(this.find(uri));
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

  public listByKey(key: string): Resource[] {
    let needle = '/' + key;
    if (!getExtension(needle)) {
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
    let identifier = getShortestIdentifier(
      forResource.path,
      amongst.map(uri => uri.path)
    );

    identifier = identifier.endsWith('.md')
      ? identifier.slice(0, -3)
      : identifier;

    if (forResource.fragment) {
      identifier += `#${forResource.fragment}`;
    }

    return identifier;
  }

  public find(reference: URI | string, baseUri?: URI): Resource | null {
    if (URI.isUri(reference)) {
      return this.resources.get(normalize((reference as URI).path)) ?? null;
    }
    let resource: Resource | null = null;
    let [pathOrKey, fragment] = (reference as string).split('#');
    if (isPath(pathOrKey)) {
      let path = pathOrKey;
      if (isAbsolute(path) || isSome(baseUri)) {
        if (!getExtension(path)) {
          path = path + '.md';
        }
        const uri = URI.resolve(path, baseUri);
        resource = uri ? this.resources.get(normalize(uri.path)) : null;
      }
    } else {
      const resources = this.listByKey(pathOrKey);
      const sorted = resources.sort((a, b) =>
        a.uri.path.localeCompare(b.uri.path)
      );
      resource = sorted[0];
    }
    if (resource && fragment) {
      resource = { ...resource, uri: URI.withFragment(resource.uri, fragment) };
    }
    return resource ?? null;
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

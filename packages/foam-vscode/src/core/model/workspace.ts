import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { isAbsolute, getExtension, changeExtension } from '../utils/path';
import { isSome } from '../utils';
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
  private _resources: Map<string, Resource> = new Map();

  registerProvider(provider: ResourceProvider) {
    this.providers.push(provider);
    return provider.init(this);
  }

  set(resource: Resource) {
    const old = this.find(resource.uri);
    this._resources.set(normalize(resource.uri.path), resource);
    isSome(old)
      ? this.onDidUpdateEmitter.fire({ old: old, new: resource })
      : this.onDidAddEmitter.fire(resource);
    return this;
  }

  delete(uri: URI) {
    const deleted = this._resources.get(normalize(uri.path));
    this._resources.delete(normalize(uri.path));

    isSome(deleted) && this.onDidDeleteEmitter.fire(deleted);
    return deleted ?? null;
  }

  public exists(uri: URI): boolean {
    return isSome(this.find(uri));
  }

  public list(): Resource[] {
    return Array.from(this._resources.values());
  }

  public resources(): IterableIterator<Resource> {
    return this._resources.values();
  }

  public get(uri: URI): Resource {
    const note = this.find(uri);
    if (isSome(note)) {
      return note;
    } else {
      throw new Error('Resource not found: ' + uri.path);
    }
  }

  public listByIdentifier(identifier: string): Resource[] {
    const needle = normalize('/' + identifier);
    const mdNeedle =
      getExtension(needle) !== '.md' ? needle + '.md' : undefined;
    const resources = [];
    for (const key of this._resources.keys()) {
      if ((mdNeedle && key.endsWith(mdNeedle)) || key.endsWith(needle)) {
        resources.push(this._resources.get(normalize(key)));
      }
    }
    return resources.sort((a, b) => a.uri.path.localeCompare(b.uri.path));
  }

  /**
   * Returns the minimal identifier for the given resource
   *
   * @param forResource the resource to compute the identifier for
   */
  public getIdentifier(forResource: URI, exclude?: URI[]): string {
    const amongst = [];
    const basename = forResource.getBasename();
    for (const res of this._resources.values()) {
      // skip elements that cannot possibly match
      if (!res.uri.path.endsWith(basename)) {
        continue;
      }
      // skip self
      if (res.uri.isEqual(forResource)) {
        continue;
      }
      // skip exclude list
      if (exclude && exclude.find(ex => ex.isEqual(res.uri))) {
        continue;
      }
      amongst.push(res.uri);
    }

    let identifier = FoamWorkspace.getShortestIdentifier(
      forResource.path,
      amongst.map(uri => uri.path)
    );
    identifier = changeExtension(identifier, '.md', '');
    if (forResource.fragment) {
      identifier += `#${forResource.fragment}`;
    }
    return identifier;
  }

  public find(reference: URI | string, baseUri?: URI): Resource | null {
    if (reference instanceof URI) {
      return this._resources.get(normalize((reference as URI).path)) ?? null;
    }
    let resource: Resource | null = null;
    const [path, fragment] = (reference as string).split('#');
    if (FoamWorkspace.isIdentifier(path)) {
      resource = this.listByIdentifier(path)[0];
    } else {
      if (isAbsolute(path) || isSome(baseUri)) {
        if (getExtension(path) !== '.md') {
          const uri = baseUri.resolve(path + '.md');
          resource = uri ? this._resources.get(normalize(uri.path)) : null;
        }
        if (!resource) {
          const uri = baseUri.resolve(path);
          resource = uri ? this._resources.get(normalize(uri.path)) : null;
        }
      }
    }
    if (resource && fragment) {
      resource = { ...resource, uri: resource.uri.withFragment(fragment) };
    }
    return resource ?? null;
  }

  public resolveLink(resource: Resource, link: ResourceLink): URI {
    // TODO add tests
    for (const provider of this.providers) {
      if (provider.supports(resource.uri)) {
        return provider.resolveLink(this, resource, link);
      }
    }
    throw new Error(
      `Couldn't find provider for resource "${resource.uri.toString()}"`
    );
  }

  public read(uri: URI): Promise<string | null> {
    for (const provider of this.providers) {
      if (provider.supports(uri)) {
        return provider.read(uri);
      }
    }
    return Promise.resolve(null);
  }

  public readAsMarkdown(uri: URI): Promise<string | null> {
    for (const provider of this.providers) {
      if (provider.supports(uri)) {
        return provider.readAsMarkdown(uri);
      }
    }
    return Promise.resolve(null);
  }

  public dispose(): void {
    this.onDidAddEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this.onDidUpdateEmitter.dispose();
  }

  static isIdentifier(path: string): boolean {
    return !(
      path.startsWith('/') ||
      path.startsWith('./') ||
      path.startsWith('../')
    );
  }

  /**
   * Returns the minimal identifier for the given string amongst others
   *
   * @param forPath the value to compute the identifier for
   * @param amongst the set of strings within which to find the identifier
   */
  static getShortestIdentifier(forPath: string, amongst: string[]): string {
    const needleTokens = forPath.split('/').reverse();
    const haystack = amongst
      .filter(value => value !== forPath)
      .map(value => value.split('/').reverse());

    let tokenIndex = 0;
    let res = needleTokens;
    while (tokenIndex < needleTokens.length) {
      for (let j = haystack.length - 1; j >= 0; j--) {
        if (
          haystack[j].length < tokenIndex ||
          needleTokens[tokenIndex] !== haystack[j][tokenIndex]
        ) {
          haystack.splice(j, 1);
        }
      }
      if (haystack.length === 0) {
        res = needleTokens.splice(0, tokenIndex + 1);
        break;
      }
      tokenIndex++;
    }
    const identifier = res
      .filter(token => token.trim() !== '')
      .reverse()
      .join('/');

    return identifier;
  }
}

const normalize = (v: string) => v.toLocaleLowerCase();

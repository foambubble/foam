import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { isAbsolute, getExtension, changeExtension } from '../utils/path';
import { isSome } from '../utils';
import { Emitter } from '../common/event';
import { ResourceProvider } from './provider';
import { IDisposable } from '../common/lifecycle';
import { IDataStore } from '../services/datastore';
import TrieMap from 'mnemonist/trie-map';

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
  private _resources: TrieMap<string, Resource> = new TrieMap();

  /**
   * @param defaultExtension: The default extension for notes in this workspace (e.g. `.md`)
   */
  constructor(public defaultExtension: string = '.md') {}

  registerProvider(provider: ResourceProvider) {
    this.providers.push(provider);
  }

  set(resource: Resource) {
    const old = this.find(resource.uri);

    // store resource
    this._resources.set(this.getTrieIdentifier(resource.uri.path), resource);

    isSome(old)
      ? this.onDidUpdateEmitter.fire({ old: old, new: resource })
      : this.onDidAddEmitter.fire(resource);
    return this;
  }

  delete(uri: URI) {
    const deleted = this._resources.get(this.getTrieIdentifier(uri));
    this._resources.delete(this.getTrieIdentifier(uri));

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
    const resources: Array<Resource> = Array.from(
      this._resources.values()
    ).sort(Resource.sortByPath);

    return resources.values();
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
    let needle = this.getTrieIdentifier(identifier);

    const mdNeedle =
      getExtension(normalize(identifier)) !== this.defaultExtension
        ? this.getTrieIdentifier(identifier + this.defaultExtension)
        : undefined;

    const resources: Resource[] = [];

    this._resources.find(needle).forEach(elm => resources.push(elm[1]));

    if (mdNeedle) {
      this._resources.find(mdNeedle).forEach(elm => resources.push(elm[1]));
    }

    return resources.sort(Resource.sortByPath);
  }

  /**
   * Returns the minimal identifier for the given resource
   *
   * @param forResource the resource to compute the identifier for
   */
  public getIdentifier(forResource: URI, exclude?: URI[]): string {
    const amongst = [];
    const basename = forResource.getBasename();

    this.listByIdentifier(basename).map(res => {
      // skip self
      if (res.uri.isEqual(forResource)) {
        return;
      }

      // skip exclude list
      if (exclude && exclude.find(ex => ex.isEqual(res.uri))) {
        return;
      }
      amongst.push(res.uri);
    });

    let identifier = FoamWorkspace.getShortestIdentifier(
      forResource.path,
      amongst.map(uri => uri.path)
    );
    identifier = changeExtension(identifier, this.defaultExtension, '');
    if (forResource.fragment) {
      identifier += `#${forResource.fragment}`;
    }
    return identifier;
  }

  /**
   * Returns a note identifier in reversed order. Used to optimise the storage of notes in
   * the workspace to optimise retrieval of notes.
   *
   * @param reference the URI path to reverse
   */
  private getTrieIdentifier(reference: URI | string): string {
    let path: string;
    if (reference instanceof URI) {
      path = (reference as URI).path;
    } else {
      path = reference as string;
    }

    let reversedPath = normalize(path).split('/').reverse().join('/');

    if (reversedPath.indexOf('/') < 0) {
      reversedPath = reversedPath + '/';
    }

    return reversedPath;
  }

  public find(reference: URI | string, baseUri?: URI): Resource | null {
    if (reference instanceof URI) {
      return this._resources.get(this.getTrieIdentifier(reference)) ?? null;
    }
    let resource: Resource | null = null;
    const [path, fragment] = (reference as string).split('#');
    if (FoamWorkspace.isIdentifier(path)) {
      resource = this.listByIdentifier(path)[0];
    } else {
      const candidates = [path, path + this.defaultExtension];
      for (const candidate of candidates) {
        const searchKey = isAbsolute(candidate)
          ? candidate
          : isSome(baseUri)
          ? baseUri.resolve(candidate).path
          : null;
        resource = this._resources.get(this.getTrieIdentifier(searchKey));
        if (resource) {
          break;
        }
      }
    }
    if (resource && fragment) {
      resource = {
        ...resource,
        uri: resource.uri.with({ fragment: fragment }),
      };
    }
    return resource ?? null;
  }

  public resolveLink(resource: Resource, link: ResourceLink): URI {
    for (const provider of this.providers) {
      if (provider.supports(resource.uri)) {
        return provider.resolveLink(this, resource, link);
      }
    }
    throw new Error(
      `Couldn't find provider for resource "${resource.uri.toString()}"`
    );
  }

  public fetch(uri: URI): Promise<Resource | null> {
    for (const provider of this.providers) {
      if (provider.supports(uri)) {
        return provider.fetch(uri);
      }
    }
    return Promise.resolve(null);
  }

  /**
   * Takes a resource URI, and adds it to the workspace as a resource.
   * If the URI is not supported by any provider or is not found, it will not
   * add anything to the workspace, and return null.
   *
   * @param uri the URI where the resource is located
   * @returns A promise to the Resource, or null if none was found
   */
  public async fetchAndSet(uri: URI): Promise<Resource | null> {
    const resource = await this.fetch(uri);
    resource && this.set(resource);
    return resource;
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

  static async fromProviders(
    providers: ResourceProvider[],
    dataStore: IDataStore,
    defaultExtension: string = '.md'
  ): Promise<FoamWorkspace> {
    const workspace = new FoamWorkspace(defaultExtension);
    await Promise.all(providers.map(p => workspace.registerProvider(p)));
    const files = await dataStore.list();
    await Promise.all(files.map(f => workspace.fetchAndSet(f)));
    return workspace;
  }
}

const normalize = (v: string) => v.toLocaleLowerCase();

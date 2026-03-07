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
   * Maps a normalized directory path to the URI of its directory index file owner.
   * Only index and README files (with any configured note extension) are registered here.
   * Priority: index > README. Maintained independently of the main trie.
   */
  private _directoryIndex: Map<string, URI> = new Map();

  /** Basenames (without extension, lowercase) that qualify as directory index files, in priority order */
  private static readonly DIRECTORY_INDEX_NAMES = ['index', 'readme'];

  /**
   * The root URIs of this workspace, in priority order.
   * Used for resolving workspace-relative paths.
   * First root is always used when a path must be resolved to exactly one root.
   */
  readonly roots: URI[];

  /**
   * @param roots The root URIs of the workspace (e.g. VS Code workspace folders)
   * @param defaultExtension The default extension for notes in this workspace (e.g. `.md`)
   */
  constructor(roots: URI[] = [], public defaultExtension: string = '.md') {
    this.roots = roots;
  }

  registerProvider(provider: ResourceProvider) {
    this.providers.push(provider);
  }

  /**
   * Resolves a path string to an absolute URI within this workspace.
   *
   * Resolution rules (in order):
   * 1. Filesystem-absolute path already under a workspace root → returned as-is
   * 2. Workspace-relative absolute path (starts with '/' but not under any root) →
   *    resolved as roots[0].joinPath(path)
   * 3. Relative path → resolved relative to `relativeTo` if provided, otherwise roots[0]
   *
   * When roots is empty, absolute paths are returned via URI.file() and relative paths
   * require a `relativeTo` base.
   */
  resolveUri(filepath: string, relativeTo?: URI): URI {
    const isDrivePath = /^[a-zA-Z]:/.test(filepath);
    const isAbsolutePath = filepath.startsWith('/') || isDrivePath;

    if (isAbsolutePath) {
      if (this.roots.length === 0) {
        return URI.file(filepath);
      }
      // Normalize Windows drive paths to POSIX form (/C:/...) before comparison,
      // since root.path is always in POSIX form. Raw backslash paths like
      // C:\workspace\note.md would never match root.path otherwise.
      const normalizedFilepath = isDrivePath
        ? URI.file(filepath).path
        : filepath;
      const isUnderRoot = this.roots.some(root =>
        isDrivePath
          ? normalizedFilepath
              .toLowerCase()
              .startsWith(root.path.toLowerCase() + '/') ||
            normalizedFilepath.toLowerCase() === root.path.toLowerCase()
          : normalizedFilepath.startsWith(root.path + '/') ||
            normalizedFilepath === root.path
      );
      if (isUnderRoot) {
        return this.roots[0].forPath(normalizedFilepath); // case 1: already absolute under root
      }
      return this.roots[0].joinPath(normalizedFilepath); // case 2: workspace-relative absolute
    }

    // case 3: relative path
    if (relativeTo) {
      // relativeTo is a file URI — resolve against its parent directory
      return relativeTo.getDirectory().joinPath(filepath);
    }
    if (this.roots.length === 0) {
      throw new Error(
        'Cannot resolve relative path without a relativeTo URI or workspace roots'
      );
    }
    // roots[0] is a directory — join directly
    return this.roots[0].joinPath(filepath);
  }

  set(resource: Resource) {
    const old = this.find(resource.uri);

    // store resource
    this._resources.set(this.getTrieIdentifier(resource.uri.path), resource);
    this._registerDirectoryIndex(resource);

    isSome(old)
      ? this.onDidUpdateEmitter.fire({ old: old, new: resource })
      : this.onDidAddEmitter.fire(resource);
    return this;
  }

  delete(uri: URI) {
    const deleted = this._resources.get(this.getTrieIdentifier(uri));
    this._resources.delete(this.getTrieIdentifier(uri));
    this._unregisterDirectoryIndex(uri);

    isSome(deleted) && this.onDidDeleteEmitter.fire(deleted);
    return deleted ?? null;
  }

  clear() {
    const resources = Array.from(this._resources.values());
    this._resources.clear();
    this._directoryIndex.clear();

    // Fire delete events for all resources
    resources.forEach(resource => {
      this.onDidDeleteEmitter.fire(resource);
    });
  }

  /**
   * Returns the priority index of a URI as a directory index file (lower = higher priority).
   * Returns -1 if the URI is not a directory index file.
   */
  private _directoryIndexPriority(uri: URI): number {
    const ext = uri.getExtension();
    if (!ext) return -1;
    const name = uri.getBasename().slice(0, -ext.length).toLowerCase();
    return FoamWorkspace.DIRECTORY_INDEX_NAMES.indexOf(name);
  }

  private _registerDirectoryIndex(resource: Resource): void {
    const priority = this._directoryIndexPriority(resource.uri);
    if (priority === -1) return;

    const dirPath = normalize(resource.uri.getDirectory().path);
    const currentOwnerUri = this._directoryIndex.get(dirPath);
    if (currentOwnerUri) {
      const currentPriority = this._directoryIndexPriority(currentOwnerUri);
      if (priority >= currentPriority) return; // current owner has equal or higher priority
    }
    this._directoryIndex.set(dirPath, resource.uri);
  }

  private _unregisterDirectoryIndex(uri: URI): void {
    const priority = this._directoryIndexPriority(uri);
    if (priority === -1) return;

    const dirPath = normalize(uri.getDirectory().path);
    const currentOwnerUri = this._directoryIndex.get(dirPath);
    if (
      !currentOwnerUri ||
      normalize(currentOwnerUri.path) !== normalize(uri.path)
    )
      return;

    // Resource already removed from _resources — scan remaining for a next-best candidate
    const nextOwner = this.list()
      .filter(r => normalize(r.uri.getDirectory().path) === dirPath)
      .map(r => ({
        resource: r,
        priority: this._directoryIndexPriority(r.uri),
      }))
      .filter(({ priority }) => priority !== -1)
      .sort((a, b) => a.priority - b.priority)[0]?.resource;

    if (nextOwner) {
      this._directoryIndex.set(dirPath, nextOwner.uri);
    } else {
      this._directoryIndex.delete(dirPath);
    }
  }

  /**
   * Returns the directory index file for the given directory path, or null if none exists.
   * The directory path should be an absolute path string (e.g. resource.uri.getDirectory().path).
   */
  public findByDirectory(dirPath: string): Resource | null {
    const ownerUri = this._directoryIndex.get(normalize(dirPath));
    if (!ownerUri) return null;
    return this._resources.get(this.getTrieIdentifier(ownerUri)) ?? null;
  }

  /**
   * Returns all directory index resources whose directory path ends with the given identifier.
   * Used to resolve wikilinks like [[bar]] or [[zoo/bar]] to directory index files.
   * Results are sorted by path for deterministic ordering.
   */
  public listByDirectoryIdentifier(identifier: string): Resource[] {
    const normalizedId = normalize(identifier);
    const results: Resource[] = [];
    for (const [dirPath, uri] of this._directoryIndex.entries()) {
      if (dirPath === normalizedId || dirPath.endsWith('/' + normalizedId)) {
        const resource = this._resources.get(this.getTrieIdentifier(uri));
        if (resource) results.push(resource);
      }
    }
    return results.sort(Resource.sortByPath);
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

    let resources: Resource[] = [];

    this._resources.find(needle).forEach(elm => resources.push(elm[1]));

    if (mdNeedle) {
      this._resources.find(mdNeedle).forEach(elm => resources.push(elm[1]));
    }

    // if multiple resources found, try to filter exact case matches
    if (resources.length > 1) {
      resources = resources.filter(
        r =>
          r.uri.getBasename() === identifier ||
          r.uri.getBasename() === identifier + this.defaultExtension
      );
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

    this.listByIdentifier(basename).forEach(res => {
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
   * Returns the shortest unambiguous directory-style identifier for a directory index file
   * (e.g. `bar` or `zoo/bar`), or null if the resource is not the current directory index owner.
   *
   * Use this when `foam.links.directory.completionStyle` is `"directory"`.
   */
  public getDirectoryIdentifier(forResource: URI): string | null {
    const dirPath = normalize(forResource.getDirectory().path);
    const ownerUri = this._directoryIndex.get(dirPath);
    if (!ownerUri || normalize(ownerUri.path) !== normalize(forResource.path)) {
      return null;
    }
    const otherDirPaths = Array.from(this._directoryIndex.keys()).filter(
      dp => dp !== dirPath
    );
    return FoamWorkspace.getShortestIdentifier(dirPath, otherDirPaths);
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
        if (isAbsolute(candidate)) {
          // Try roots[0] first (via resolveUri which handles already-under-root paths)
          const resolvedUri = this.resolveUri(candidate);
          resource =
            this._resources.get(this.getTrieIdentifier(resolvedUri)) ?? null;
          // For workspace-relative absolute paths in multi-root workspaces,
          // also search remaining roots in case the resource lives in a different root
          if (!resource && this.roots.length > 1) {
            for (let i = 1; i < this.roots.length; i++) {
              const altUri = this.roots[i].joinPath(candidate);
              resource =
                this._resources.get(this.getTrieIdentifier(altUri)) ?? null;
              if (resource) {
                break;
              }
            }
          }
        } else {
          const resolvedUri = isSome(baseUri)
            ? baseUri.resolve(candidate)
            : null;
          resource = resolvedUri
            ? this._resources.get(this.getTrieIdentifier(resolvedUri))
            : null;
        }
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
    roots: URI[],
    providers: ResourceProvider[],
    dataStore: IDataStore,
    defaultExtension: string = '.md'
  ): Promise<FoamWorkspace> {
    const workspace = new FoamWorkspace(roots, defaultExtension);
    await Promise.all(providers.map(p => workspace.registerProvider(p)));
    const files = await dataStore.list();
    await Promise.all(files.map(f => workspace.fetchAndSet(f)));
    return workspace;
  }
}

const normalize = (v: string) => v.toLocaleLowerCase();

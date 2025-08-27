import { Resource, ResourceLink } from '.././note';
import { URI } from '.././uri';
import { isSome } from '../../utils';
import { Emitter } from '../../common/event';
import { ResourceProvider } from '.././provider';
import { IDisposable } from '../../common/lifecycle';
import { IDataStore } from '../../services/datastore';
import { TrainNoteWorkspace } from './trainNoteWorkspace';
import { Workspace, TrieIdentifier } from './workspace';

export class FoamWorkspace extends Workspace<Resource> implements IDisposable {
  private onDidAddEmitter = new Emitter<{ id: string; resource: Resource }>();
  private onDidUpdateEmitter = new Emitter<{
    id: string;
    old: Resource;
    new: Resource;
  }>();
  private onDidDeleteEmitter = new Emitter<{
    id: string;
    resource: Resource;
  }>();
  onDidAdd = this.onDidAddEmitter.event;
  onDidUpdate = this.onDidUpdateEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  private providers: ResourceProvider[] = [];
  public trainNoteWorkspace = TrainNoteWorkspace.fromWorkspace(this);

  /**
   * @param defaultExtension: The default extension for notes in this workspace (e.g. `.md`)
   */
  constructor(defaultExtension: string = '.md') {
    super();
    this.defaultExtension = defaultExtension;
  }

  public getTrieIdentifier() {
    return new TrieIdentifier(this._items, this.defaultExtension);
  }

  registerProvider(provider: ResourceProvider) {
    this.providers.push(provider);
  }

  set(resource: Resource) {
    const old = this.find(resource.uri);
    const id = this.getTrieIdentifier().get(resource.uri.path);

    // store resource
    this._items.set(id, resource);

    isSome(old)
      ? this.onDidUpdateEmitter.fire({ id: id, old: old, new: resource })
      : this.onDidAddEmitter.fire({ id: id, resource: resource });
    return this;
  }

  delete(uri: URI) {
    const targetId = this.getTrieIdentifier().get(uri);
    const deleted = this._items.get(targetId);
    this._items.delete(targetId);

    isSome(deleted) &&
      this.onDidDeleteEmitter.fire({ id: targetId, resource: deleted });
    return deleted ?? null;
  }

  clear() {
    const resources = Array.from(this._items.values());
    this._items.clear();

    // Fire delete events for all resources
    resources.forEach(resource => {
      const id = this.getTrieIdentifier().get(resource.uri.path);
      this.onDidDeleteEmitter.fire({ id: id, resource: resource });
    });
  }

  public exists(uri: URI): boolean {
    return isSome(this.find(uri));
  }

  public resources(): IterableIterator<Resource> {
    const resources: Array<Resource> = Array.from(this._items.values()).sort(
      Resource.sortByPath
    );

    return resources.values();
  }

  public resolveLink = (resource: Resource, link: ResourceLink): URI => {
    for (const provider of this.providers) {
      if (provider.supports(resource.uri)) {
        return provider.resolveLink(this, resource, link);
      }
    }
    throw new Error(
      `Couldn't find provider for resource "${resource.uri.toString()}"`
    );
  };

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

import { Resource, ResourceLink } from './note';
import { URI } from './uri';
import { FoamWorkspace } from './workspace';
import { IDisposable } from '../common/lifecycle';
import { Logger } from '../utils/log';
import { Emitter } from '../common/event';

export type Connection = {
  source: URI;
  target: URI;
  link: ResourceLink;
};

const pathToPlaceholderId = (value: string) => value;
const uriToPlaceholderId = (uri: URI) => pathToPlaceholderId(uri.path);

export class FoamGraph implements IDisposable {
  /**
   * Placehoders by key / slug / value
   */
  public readonly placeholders: Map<string, URI> = new Map();
  /**
   * Maps the connections starting from a URI
   */
  public readonly links: Map<string, Connection[]> = new Map();
  /**
   * Maps the connections arriving to a URI
   */
  public readonly backlinks: Map<string, Connection[]> = new Map();

  private onDidUpdateEmitter = new Emitter<void>();
  onDidUpdate = this.onDidUpdateEmitter.event;

  /**
   * List of disposables to destroy with the workspace
   */
  private disposables: IDisposable[] = [];

  constructor(private readonly workspace: FoamWorkspace) {}

  public contains(uri: URI): boolean {
    return this.getConnections(uri).length > 0;
  }

  public getAllNodes(): URI[] {
    return [
      ...Array.from(this.placeholders.values()),
      ...this.workspace.list().map(r => r.uri),
    ];
  }

  public getAllConnections(): Connection[] {
    return Array.from(this.links.values()).flat();
  }

  public getConnections(uri: URI): Connection[] {
    return [
      ...(this.links.get(uri.path) || []),
      ...(this.backlinks.get(uri.path) || []),
    ];
  }

  public getLinks(uri: URI): Connection[] {
    return this.links.get(uri.path) ?? [];
  }

  public getBacklinks(uri: URI): Connection[] {
    return this.backlinks.get(uri.path) ?? [];
  }

  /**
   * Computes all the links in the workspace, connecting notes and
   * creating placeholders.
   *
   * @param workspace the target workspace
   * @param keepMonitoring whether to recompute the links when the workspace changes
   * @param debounceFor how long to wait between change detection and graph update
   * @returns the FoamGraph
   */
  public static fromWorkspace(
    workspace: FoamWorkspace,
    keepMonitoring = false
  ): FoamGraph {
    const graph = new FoamGraph(workspace);
    graph.update();
    if (keepMonitoring) {
      // Incremental handlers, not a full rebuild — see onResource* below. Each
      // touches only the affected connections, then fires onDidUpdate. They are
      // NOT debounced: debouncing coalesces events, but incremental updates need
      // every event (each carries a distinct diff to apply).
      graph.disposables.push(
        workspace.onDidAdd(resource => graph.onResourceAdded(resource)),
        workspace.onDidUpdate(({ old, new: updated }) =>
          graph.onResourceUpdated(old, updated)
        ),
        workspace.onDidDelete(resource => graph.onResourceDeleted(resource))
      );
    }
    return graph;
  }

  /**
   * Full rebuild of the graph from the workspace. Used for the initial build and
   * available as a fallback; steady-state changes go through the incremental
   * onResource* handlers.
   */
  public update() {
    const start = Date.now();
    this.backlinks.clear();
    this.links.clear();
    this.placeholders.clear();

    for (const resource of this.workspace.resources()) {
      this.connectResource(resource);
    }

    const end = Date.now();
    Logger.debug(`Graph updated in ${end - start}ms`);
    this.onDidUpdateEmitter.fire();
  }

  /**
   * A note's content changed. Its OUTGOING links may have changed, but incoming
   * backlinks are unaffected (the note existed before and after, so how other
   * notes resolve to it does not change). Reconnect just this note's links.
   */
  private onResourceUpdated(old: Resource, updated: Resource) {
    this.disconnectResource(old.uri);
    this.connectResource(updated);
    this.onDidUpdateEmitter.fire();
  }

  /**
   * A new note appeared. Connect its outgoing links, then handle the fan-out:
   * notes that were linking to a PLACEHOLDER which this note now fills must be
   * recomputed (their link resolves to the real note instead). We can't cheaply
   * invert resolution, so we re-resolve the sources of each existing placeholder
   * and reconnect those whose target changed.
   */
  private onResourceAdded(resource: Resource) {
    this.reconnectAffectedPlaceholderSources();
    this.connectResource(resource);
    this.onDidUpdateEmitter.fire();
  }

  /**
   * A note was removed. Drop its outgoing links, then handle the fan-out: notes
   * that linked TO this note now resolve to a placeholder, so recompute them.
   * Those sources are exactly the (now stale) backlinks to the deleted note.
   */
  private onResourceDeleted(resource: Resource) {
    const affectedSources = this.sourcesLinkingTo(resource.uri);
    this.disconnectResource(resource.uri);
    this.reconnectSources(affectedSources);
    this.onDidUpdateEmitter.fire();
  }

  /** Distinct source URIs whose links currently point at `target.path`. */
  private sourcesLinkingTo(target: URI): URI[] {
    const seen = new Map<string, URI>();
    for (const c of this.backlinks.get(target.path) ?? []) {
      seen.set(c.source.path, c.source);
    }
    return Array.from(seen.values());
  }

  /**
   * Reconnects the outgoing links of every source that currently links to a
   * placeholder. Used on note-add: filling a placeholder changes how its
   * referrers resolve. Bounded by the number of placeholder backlinks, not the
   * workspace size. Reconnecting is idempotent, so re-resolving unaffected
   * sources is harmless.
   */
  private reconnectAffectedPlaceholderSources() {
    const affected = new Map<string, URI>();
    for (const placeholder of this.placeholders.values()) {
      for (const source of this.sourcesLinkingTo(placeholder)) {
        affected.set(source.path, source);
      }
    }
    this.reconnectSources(Array.from(affected.values()));
  }

  /** Disconnects and re-resolves the outgoing links of each given source. */
  private reconnectSources(sources: URI[]) {
    for (const source of sources) {
      const resource = this.workspace.find(source);
      if (resource) {
        this.disconnectResource(resource.uri);
        this.connectResource(resource);
      }
    }
  }

  /** Resolves and connects all of a resource's (non-external) links. */
  private connectResource(resource: Resource) {
    for (const link of resource.links) {
      try {
        if (link.type === 'external') {
          continue;
        }
        const targetUri = this.workspace.resolveLink(resource, link);
        this.connect(resource.uri, targetUri, link);
      } catch (e) {
        Logger.error(
          `Error while resolving link ${
            link.rawText
          } in ${resource.uri.toFsPath()}, skipping.`,
          link,
          e
        );
      }
    }
  }

  /**
   * Removes all connections originating from `source`: deletes its `links`
   * entry, filters it out of each affected target's `backlinks`, and drops any
   * placeholder left with no remaining backlinks.
   */
  private disconnectResource(source: URI) {
    const outgoing = this.links.get(source.path) ?? [];
    for (const connection of outgoing) {
      const targetPath = connection.target.path;
      const targetBacklinks = this.backlinks.get(targetPath);
      if (targetBacklinks) {
        const remaining = targetBacklinks.filter(
          c => c.source.path !== source.path
        );
        if (remaining.length > 0) {
          this.backlinks.set(targetPath, remaining);
        } else {
          this.backlinks.delete(targetPath);
          // A placeholder with no backlinks is no longer referenced.
          if (connection.target.isPlaceholder()) {
            this.placeholders.delete(uriToPlaceholderId(connection.target));
          }
        }
      }
    }
    this.links.delete(source.path);
  }

  private connect(source: URI, target: URI, link: ResourceLink) {
    const connection = { source, target, link };

    if (!this.links.has(source.path)) {
      this.links.set(source.path, []);
    }
    this.links.get(source.path)?.push(connection);

    if (!this.backlinks.has(target.path)) {
      this.backlinks.set(target.path, []);
    }
    this.backlinks.get(target.path)?.push(connection);

    if (target.isPlaceholder()) {
      this.placeholders.set(uriToPlaceholderId(target), target);
    }
    return this;
  }

  public dispose(): void {
    this.onDidUpdateEmitter.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

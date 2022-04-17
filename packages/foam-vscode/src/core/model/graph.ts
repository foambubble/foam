import { debounce } from 'lodash';
import { ResourceLink } from './note';
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
    keepMonitoring = false,
    debounceFor = 0
  ): FoamGraph {
    const graph = new FoamGraph(workspace);
    graph.update();
    if (keepMonitoring) {
      const updateGraph =
        debounceFor > 0
          ? debounce(graph.update.bind(graph), 500)
          : graph.update.bind(graph);
      graph.disposables.push(
        workspace.onDidAdd(updateGraph),
        workspace.onDidUpdate(updateGraph),
        workspace.onDidDelete(updateGraph)
      );
    }
    return graph;
  }

  private update() {
    const start = Date.now();
    this.backlinks.clear();
    this.links.clear();
    this.placeholders.clear();

    for (const resource of this.workspace.resources()) {
      for (const link of resource.links) {
        try {
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

    const end = Date.now();
    Logger.info(`Graph updated in ${end - start}ms`);
    this.onDidUpdateEmitter.fire();
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

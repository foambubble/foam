import { diff } from 'fast-array-diff';
import { isEqual } from 'lodash';
import { URI } from '../common/uri';
import { Resource } from '../model/note';
// import { Event, Emitter } from '../common/event';
import { FoamWorkspace } from './workspace';
import { IDisposable } from 'index';

export type Connection = {
  source: URI;
  target: URI;
};

/**
 * Creates a graph from the given workspace
 *
 * @param workspace the workspace to build the graph from
 * @param keepMonitoring whether the graph should reflect changes in the workspace
 */
export function createFromWorkspace(
  workspace: FoamWorkspace,
  keepMonitoring: boolean
): FoamGraph {
  const graph = Object.values(workspace.list()).reduce(
    (g, resource) => FoamGraph.addResource(g, workspace, resource),
    new FoamGraph()
  );
  if (keepMonitoring) {
    graph.disposables.push(
      workspace.onDidAdd(resource => {
        FoamGraph.addResource(graph, workspace, resource);
      }),
      workspace.onDidUpdate(change => {
        FoamGraph.updateResource(graph, workspace, change.old, change.new);
      }),
      workspace.onDidDelete(resource => {
        FoamGraph.deleteResource(graph, workspace, resource);
      })
    );
  }
  return graph;
}

export class FoamGraph implements IDisposable {
  /**
   * Maps the connections starting from a URI
   */
  private links: { [key: string]: Connection[] } = {};
  /**
   * Maps the connections arriving to a URI
   */
  private backlinks: { [key: string]: Connection[] } = {}; // target uri => source uri
  /**
   * List of disposables to destroy with the graph
   * (generally listeners created by the graph factory)
   */
  disposables: IDisposable[] = [];

  updateResource = FoamGraph.updateResource.bind(null, this);
  addResource = FoamGraph.addResource.bind(null, this);
  deleteResource = FoamGraph.deleteResource.bind(null, this);
  connect = FoamGraph.connect.bind(null, this);
  disconnect = FoamGraph.disconnect.bind(null, this);
  getConnections = FoamGraph.getConnections.bind(null, this);
  getLinks = FoamGraph.getLinks.bind(null, this);
  getBacklinks = FoamGraph.getBacklinks.bind(null, this);

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }

  public static updateResource(
    graph: FoamGraph,
    workspace: FoamWorkspace,
    oldResource: Resource,
    newResource: Resource
  ) {
    if (oldResource.uri.path !== newResource.uri.path) {
      throw new Error(
        'Unexpected State: update should only be called on same resource ' +
          {
            old: oldResource,
            new: newResource,
          }
      );
    }
    if (oldResource.type === 'note' && newResource.type === 'note') {
      const patch = diff(oldResource.links, newResource.links, isEqual);
      graph = patch.removed.reduce((g, link) => {
        const target = workspace.resolveLink(oldResource, link);
        return FoamGraph.disconnect(g, oldResource.uri, target);
      }, graph);
      graph = patch.added.reduce((g, link) => {
        const target = workspace.resolveLink(newResource, link);
        return FoamGraph.connect(g, newResource.uri, target);
      }, graph);
    }
    return graph;
  }

  public static addResource(
    graph: FoamGraph,
    workspace: FoamWorkspace,
    resource: Resource
  ) {
    // prettier-ignore
    resource.type === 'note' && resource.links.forEach(link => {
      const targetUri = FoamWorkspace.resolveLink(workspace, resource, link)
      graph = FoamGraph.connect(graph, resource.uri, targetUri)
    });
    return graph;
  }

  public static deleteResource(
    graph: FoamGraph,
    workspace: FoamWorkspace,
    resource: Resource
  ) {
    if (resource.type === 'note') {
      delete graph.links[resource.uri.path];
      // resolve any link that was pointing to the deleted resource
      graph.backlinks[resource.uri.path].forEach(link => {
        const source = workspace.get(link.source);
        source.type === 'note' &&
          source.links.forEach(l => {
            const targetUri = FoamWorkspace.resolveLink(workspace, source, l);
            graph = FoamGraph.connect(graph, resource.uri, targetUri);
          });
      });
    }
  }

  public static connect(graph: FoamGraph, source: URI, target: URI) {
    const connection = {
      source: source,
      target: target,
    };

    graph.links[source.path] = graph.links[source.path] ?? [];
    graph.links[source.path].push(connection);
    graph.backlinks[target.path] = graph.backlinks[target.path] ?? [];
    graph.backlinks[target.path].push(connection);

    return graph;
  }

  public static disconnect(graph: FoamGraph, source: URI, target: URI) {
    graph.links[source.path] = graph.links[source.path]?.filter(
      c => c.source.path === source.path && c.target.path === target.path
    );
    graph.backlinks[target.path] = graph.backlinks[target.path]?.filter(
      c => c.source.path === source.path && c.target.path === target.path
    );
    return graph;
  }

  public static getAllConnections(graph: FoamGraph): Connection[] {
    return Object.values(graph.links).flat();
  }

  public static getConnections(graph: FoamGraph, uri: URI): Connection[] {
    return [...graph.links[uri.path], ...graph.backlinks[uri.path]];
  }

  public static getLinks(graph: FoamGraph, uri: URI): URI[] {
    return graph.links[uri.path]?.map(c => c.target) ?? [];
  }

  public static getBacklinks(graph: FoamGraph, uri: URI): URI[] {
    return graph.backlinks[uri.path]?.map(c => c.source) ?? [];
  }
}

import { Connection, FoamGraph } from '../model/graph';
import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';

export interface LinkEntry {
  id: string;
  uri: URI;
  title: string;
  label?: string;
}

export interface LinksResult {
  id: string;
  uri: URI;
  outgoing: LinkEntry[];
  incoming: LinkEntry[];
}

/**
 * Returns outgoing and incoming links for a resource.
 */
export function linksData(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  resource: Resource
): LinksResult {
  const id = workspace.getIdentifier(resource.uri);

  const outgoing = graph.getLinks(resource.uri).map(c => {
    const target = workspace.find(c.target);
    return {
      id: workspace.getIdentifier(c.target),
      uri: c.target,
      title: target?.title ?? '',
      label: c.link.rawText,
    };
  });

  const incoming = graph.getBacklinks(resource.uri).map(c => {
    const source = workspace.find(c.source);
    return {
      id: workspace.getIdentifier(c.source),
      uri: c.source,
      title: source?.title ?? '',
      label: c.link.rawText,
    };
  });

  return {
    id,
    uri: resource.uri,
    outgoing,
    incoming,
  };
}

export type TraversalDirection = 'links' | 'backlinks' | 'both';

export interface TraversalNode {
  uri: URI;
  title: string;
  type: string;
  /** Distance in hops from the start URI (0 for the start node itself). */
  distance: number;
}

export interface TraversalEdge {
  source: URI;
  target: URI;
  label?: string;
}

export interface TraversalResult {
  nodes: TraversalNode[];
  edges: TraversalEdge[];
}

/**
 * Performs a breadth-first traversal of the graph starting at `start`,
 * following links, backlinks, or both up to `depth` hops.
 *
 * Each node is visited at most once; the reported `distance` is the
 * shortest hop count to reach it. Edges are reported once per direction
 * even if encountered through multiple paths.
 *
 * Traversal is at note granularity: fragments (`#section`, `#^block`) are
 * not part of node identity. Two links to `[[other#a]]` and `[[other#b]]`
 * visit `other` once, and the URIs in the returned `nodes` / `edges` are
 * fragment-free so consumers can dedupe / look up by URI consistently.
 */
export function traverseGraph(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  start: URI,
  depth: number,
  direction: TraversalDirection
): TraversalResult {
  const visited = new Map<string, TraversalNode>();
  const edgeKeys = new Set<string>();
  const edges: TraversalEdge[] = [];

  const startPlain = start.asPlain();
  const startResource = workspace.find(startPlain);
  visited.set(startPlain.path, {
    uri: startPlain,
    title: startResource?.title ?? '',
    type: startResource?.type ?? 'placeholder',
    distance: 0,
  });

  let frontier: URI[] = [startPlain];
  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const next: URI[] = [];
    for (const uri of frontier) {
      const connections: { conn: Connection; target: URI }[] = [];
      if (direction === 'links' || direction === 'both') {
        for (const c of graph.getLinks(uri)) {
          connections.push({ conn: c, target: c.target });
        }
      }
      if (direction === 'backlinks' || direction === 'both') {
        for (const c of graph.getBacklinks(uri)) {
          connections.push({ conn: c, target: c.source });
        }
      }

      for (const { conn, target } of connections) {
        const sourcePlain = conn.source.asPlain();
        const targetPlain = conn.target.asPlain();
        const edgeKey = `${sourcePlain.path}➜${targetPlain.path}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({
            source: sourcePlain,
            target: targetPlain,
            label: conn.link.rawText,
          });
        }
        const nodePlain = target.asPlain();
        if (!visited.has(nodePlain.path)) {
          const resource = workspace.find(nodePlain);
          visited.set(nodePlain.path, {
            uri: nodePlain,
            title: resource?.title ?? '',
            type: resource?.type ?? 'placeholder',
            distance: hop + 1,
          });
          next.push(nodePlain);
        }
      }
    }
    frontier = next;
  }

  return {
    nodes: Array.from(visited.values()),
    edges,
  };
}

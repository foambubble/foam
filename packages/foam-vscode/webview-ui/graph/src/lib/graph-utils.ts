import type { GraphData } from '../protocol';
import type { AugmentedGraph, AugmentedNode, AugmentedLink } from './types';

export function getLinkNodeId(endpoint: string | AugmentedNode): string {
  return typeof endpoint === 'object' ? endpoint.id : endpoint;
}

export function augmentGraphInfo(graph: GraphData): AugmentedGraph {
  const augmented: AugmentedGraph = { nodeInfo: {}, links: [] };

  // Copy nodes with initialized neighbors/links
  for (const node of Object.values(graph.nodeInfo)) {
    augmented.nodeInfo[node.id] = { ...node, neighbors: [], links: [] };
  }

  // Copy links
  augmented.links = graph.links.map(l => ({ ...l }));

  // Process tags: create tag nodes and hierarchy links
  for (const node of Object.values(augmented.nodeInfo)) {
    if (!node.tags?.length) continue;
    for (const tag of node.tags) {
      const subtags = tag.label.split('/');
      for (let i = 0; i < subtags.length; i++) {
        const label = subtags.slice(0, i + 1).join('/');
        if (!augmented.nodeInfo[label]) {
          augmented.nodeInfo[label] = {
            id: label,
            title: label,
            type: 'tag',
            properties: {},
            tags: [],
            neighbors: [],
            links: [],
          };
        }
        if (i > 0) {
          const parent = subtags.slice(0, i).join('/');
          augmented.links.push({ source: parent, target: label });
        }
      }
      augmented.links.push({ source: tag.label, target: node.id });
    }
  }

  // Deduplicate links
  const seen = new Set<string>();
  augmented.links = augmented.links.filter(link => {
    const key = `${getLinkNodeId(link.source)} -> ${getLinkNodeId(link.target)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build neighbor relationships
  for (const link of augmented.links) {
    const a = augmented.nodeInfo[getLinkNodeId(link.source)];
    const b = augmented.nodeInfo[getLinkNodeId(link.target)];
    if (a && b) {
      a.neighbors.push(b.id);
      b.neighbors.push(a.id);
      a.links.push(link);
      b.links.push(link);
    }
  }

  return augmented;
}

export function getNeighbors(
  nodeId: string,
  depth: number,
  nodeInfo: Record<string, AugmentedNode>
): Set<string> {
  let neighbors = new Set([nodeId]);
  for (let i = 0; i < depth; i++) {
    const newNeighbors = new Set<string>();
    for (const id of neighbors) {
      const node = nodeInfo[id];
      if (node) {
        for (const n of node.neighbors) newNeighbors.add(n);
      } else {
        console.debug(`getNeighbors: node '${id}' not found in nodeInfo, skipping.`);
      }
    }
    for (const n of newNeighbors) neighbors.add(n);
  }
  return neighbors;
}

export function computeFocusSets(
  selectedNodes: Set<string>,
  hoverNode: string | null,
  neighborDepth: number,
  nodeInfo: Record<string, AugmentedNode>,
  links: AugmentedLink[]
): { focusNodes: Set<string>; focusLinks: Set<AugmentedLink> } {
  const focusNodes = new Set<string>();
  const focusLinks = new Set<AugmentedLink>();

  const nodesToProcess = [...selectedNodes, hoverNode].filter(
    Boolean
  ) as string[];

  for (const nodeId of nodesToProcess) {
    const neighbors = getNeighbors(nodeId, neighborDepth, nodeInfo);
    for (const n of neighbors) focusNodes.add(n);
  }

  for (const link of links) {
    const src = getLinkNodeId(link.source);
    const tgt = getLinkNodeId(link.target);
    if (focusNodes.has(src) && focusNodes.has(tgt)) {
      focusLinks.add(link);
    }
  }

  return { focusNodes, focusLinks };
}

export function getNodeState(
  nodeId: string,
  selectedNodes: Set<string>,
  hoverNode: string | null,
  focusNodes: Set<string>
): 'regular' | 'highlighted' | 'lessened' {
  if (selectedNodes.has(nodeId) || hoverNode === nodeId) return 'highlighted';
  if (focusNodes.size === 0 || focusNodes.has(nodeId)) return 'regular';
  return 'lessened';
}

export function getLinkState(
  link: AugmentedLink,
  focusNodes: Set<string>,
  focusLinks: Set<AugmentedLink>
): 'regular' | 'highlighted' | 'lessened' {
  if (focusNodes.size === 0) return 'regular';
  const src = getLinkNodeId(link.source);
  const tgt = getLinkNodeId(link.target);
  for (const fl of focusLinks) {
    if (getLinkNodeId(fl.source) === src && getLinkNodeId(fl.target) === tgt) {
      return 'highlighted';
    }
  }
  return 'lessened';
}

import type { GroupMatch, GroupRule } from '../protocol';
import { GraphModelLink } from './types';
import type {
  GraphModel,
  GraphModelNode,
  GraphScope,
  ResolvedStyle,
} from './types';
import { matchesGroup } from './groups';
import { getFocusSubset } from './graph-utils';

export interface VisibleGraph {
  nodeInfo: Record<string, GraphModelNode>;
  nodes: Array<{ id: string }>;
  links: GraphModelLink[];
}

const ALWAYS_KEEP_TYPES = new Set(['tag', 'attachment', 'image', 'placeholder']);
const BUILTIN_TYPES = new Set([...ALWAYS_KEEP_TYPES, 'note']);

export function computeVisibleGraph(
  graphModel: GraphModel,
  showNodesOfType: Record<string, boolean>,
  groups: GroupRule[],
  focusNodeId: string | null,
  graphScope: GraphScope
): VisibleGraph {
  const nodeIds = new Set(
    Object.values(graphModel.nodeInfo)
      .filter(node => isNodeVisible(node, showNodesOfType, groups))
      .map(node => node.id)
  );

  if (focusNodeId && graphScope !== 'full') {
    const focusSet = getFocusSubset(graphModel, focusNodeId, graphScope.depth);
    for (const id of nodeIds) {
      if (!focusSet.has(id)) nodeIds.delete(id);
    }
  }

  const nodeInfo: Record<string, GraphModelNode> = {};
  const nodes = [...nodeIds].map(id => {
    nodeInfo[id] = graphModel.nodeInfo[id];
    return { id };
  });
  const links = graphModel.links
    .filter(
      link =>
        nodeIds.has(GraphModelLink.getNodeId(link.source)) &&
        nodeIds.has(GraphModelLink.getNodeId(link.target))
    )
    .map(link => ({ ...link }));

  return { nodeInfo, nodes, links };
}

export function deriveNodeTypeFilters(
  graphModel: GraphModel,
  style: ResolvedStyle,
  current: Record<string, boolean>
): Record<string, boolean> {
  const types = new Set([
    ...Object.values(graphModel.nodeInfo).map(node => node.type),
    ...Object.keys(style.node).filter(type => !BUILTIN_TYPES.has(type)),
  ]);
  const next = { ...current };

  for (const type of types) {
    if (next[type] == null) {
      next[type] = type !== 'image' && type !== 'attachment';
    }
  }

  for (const type of Object.keys(next)) {
    if (!types.has(type) && !ALWAYS_KEEP_TYPES.has(type)) {
      delete next[type];
    }
  }

  return next;
}

export function computeNodeTypeCounts(
  graphModel: GraphModel | null
): Record<string, number> {
  if (!graphModel) return {};
  const counts: Record<string, number> = {};
  for (const node of Object.values(graphModel.nodeInfo)) {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  }
  return counts;
}

export function computeGroupMatchCounts(
  graphModel: GraphModel,
  groups: GroupRule[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of groups) {
    counts[group.id] = Object.values(graphModel.nodeInfo).filter(node =>
      matchesGroup(node, group)
    ).length;
  }
  return counts;
}

export function computeAutocompleteOptions(
  graphModel: GraphModel,
  property: GroupMatch['property']
): string[] {
  const nodes = Object.values(graphModel.nodeInfo);
  if (property === 'type') {
    return [...new Set(nodes.map(node => node.type))]
      .filter(type => !ALWAYS_KEEP_TYPES.has(type))
      .sort();
  }
  if (property === 'tag') {
    return [
      ...new Set(nodes.flatMap(node => (node.tags ?? []).map(tag => tag.label))),
    ].sort();
  }
  return [];
}

export function computePreviewMatchCount(
  graphModel: GraphModel,
  property: GroupMatch['property'],
  value: string
): number {
  if (!value) return 0;
  const rule: GroupRule = {
    id: '',
    label: '',
    color: '',
    enabled: true,
    match: { property, value },
  };
  return Object.values(graphModel.nodeInfo).filter(node => matchesGroup(node, rule))
    .length;
}

function isNodeVisible(
  node: GraphModelNode,
  showNodesOfType: Record<string, boolean>,
  groups: GroupRule[]
): boolean {
  if (!showNodesOfType[node.type]) return false;
  const matching = groups.filter(group => matchesGroup(node, group));
  return matching.length === 0 || matching.some(group => group.enabled);
}

import type { NodeInfo, GroupRule } from '../protocol';

// Shared display-option shapes live in the protocol (they are part of the
// persisted view state); re-exported here for the view-internal modules.
export type {
  Forces,
  Labels,
  LinkAnimation,
  GraphScope,
  Selection,
} from '../protocol';

export interface GraphModelNode extends NodeInfo {
  neighbors: string[];
  links: GraphModelLink[];
}

export interface GraphModelLink {
  source: string | GraphModelNode;
  target: string | GraphModelNode;
}

export abstract class GraphModelLink {
  static getNodeId(endpoint: GraphModelLink['source']): string {
    return typeof endpoint === 'object' ? endpoint.id : endpoint;
  }

  static getKey(link: GraphModelLink): string {
    return `${GraphModelLink.getNodeId(link.source)}->${GraphModelLink.getNodeId(
      link.target
    )}`;
  }
}

export interface GraphModel {
  nodeInfo: Record<string, GraphModelNode>;
  links: GraphModelLink[];
}

export interface ResolvedStyle {
  background: string;
  fontSize: number;
  fontFamily: string;
  lineColor: string;
  lineWidth: number;
  particleWidth: number;
  highlightedForeground: string;
  node: {
    note: string;
    placeholder: string;
    tag: string;
    [key: string]: string;
  };
  colorMode: 'none' | 'directory' | 'type';
  groups: GroupRule[];
}

export type NodeState = 'regular' | 'highlighted' | 'lessened';
export type LinkState = 'regular' | 'highlighted' | 'lessened';

export interface GraphStates {
  nodeStates: Map<string, NodeState>;
  /** Keyed by "sourceId->targetId" for identity-safe lookup across copied link objects. */
  linkStates: Map<string, LinkState>;
}


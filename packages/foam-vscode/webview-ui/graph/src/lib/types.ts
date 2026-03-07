import type { NodeInfo } from '../protocol';

export interface AugmentedNode extends NodeInfo {
  neighbors: string[];
  links: AugmentedLink[];
}

export interface AugmentedLink {
  source: string | AugmentedNode;
  target: string | AugmentedNode;
}

export interface AugmentedGraph {
  nodeInfo: Record<string, AugmentedNode>;
  links: AugmentedLink[];
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
  colorMode: 'none' | 'directory';
}

export type NodeState = 'regular' | 'highlighted' | 'lessened';
export type LinkState = 'regular' | 'highlighted' | 'lessened';

export interface Forces {
  collide: number;
  repel: number;
  link: number;
  velocityDecay: number;
}

export interface Selection {
  neighborDepth: number;
  enableRefocus: boolean;
  enableZoom: boolean;
}

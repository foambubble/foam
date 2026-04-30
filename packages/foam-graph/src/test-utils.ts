import type { GraphData } from './protocol';
import type { GraphModelNode, ResolvedStyle } from './lib/types';
import { getNodeFillAndBorder } from './lib/colors';

export const makeStyle = (overrides: Partial<ResolvedStyle> = {}): ResolvedStyle => ({
  background: '#202020',
  fontSize: 10,
  fontFamily: 'Sans-Serif',
  lineColor: '#aaaaaa',
  lineWidth: 0.2,
  particleWidth: 1.0,
  highlightedForeground: '#ffffff',
  node: {
    note: '#1111ff',
    placeholder: '#333333',
    tag: '#ffff00',
  },
  colorMode: 'type',
  ...overrides,
});

export const makeNode = (overrides: Partial<GraphModelNode> = {}): GraphModelNode => ({
  id: '/path/to/note.md',
  type: 'note',
  title: 'Note',
  properties: {},
  tags: [],
  neighbors: [],
  links: [],
  ...overrides,
});

export const makeGraph = (overrides: Partial<GraphData> = {}): GraphData => ({
  nodeInfo: {},
  links: [],
  ...overrides,
});

export const fillOf = (
  node: GraphModelNode,
  mode: ResolvedStyle['colorMode'],
  style = makeStyle()
) => getNodeFillAndBorder(node, 'regular', style, mode).fill.toString();

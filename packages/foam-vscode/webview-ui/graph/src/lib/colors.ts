import { rgb, hsl } from 'd3-color';
import type { RGBColor } from 'd3-color';
import type { AugmentedNode, ResolvedStyle } from './types';

export function getNodeTypeColor(type: string, style: ResolvedStyle): string {
  return style.node[type] ?? style.node['note'];
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
  }
  return Math.abs(hash);
}

function hashToHSL(hash: number): string {
  const hue = hash % 360;
  const saturation = 50 + (hash % 20);
  const lightness = 50 + ((hash >> 8) % 20);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function getDirectoryColor(nodeId: string): string {
  let currentPath = nodeId;
  const lastSegment = currentPath.split('/').pop();
  if (lastSegment?.includes('.')) {
    currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
  }
  if (currentPath.length > 0 && !currentPath.endsWith('/')) {
    currentPath += '/';
  }
  return hashToHSL(hashString(currentPath));
}

export function getNodeFillAndBorder(
  nodeInfo: AugmentedNode,
  state: 'regular' | 'highlighted' | 'lessened',
  style: ResolvedStyle,
  colorMode: 'none' | 'directory'
): { fill: RGBColor; border: RGBColor } {
  let baseColor: string;

  if (nodeInfo.properties.color) {
    baseColor = nodeInfo.properties.color as string;
  } else if (colorMode === 'directory') {
    baseColor = getDirectoryColor(nodeInfo.id);
  } else {
    baseColor = getNodeTypeColor(nodeInfo.type, style);
  }

  const typeFill = rgb(baseColor);

  switch (state) {
    case 'regular':
      return { fill: typeFill, border: typeFill };
    case 'lessened': {
      const transparent = typeFill.copy({ opacity: 0.05 }) as RGBColor;
      return { fill: transparent, border: transparent };
    }
    case 'highlighted':
      return { fill: typeFill, border: rgb(style.highlightedForeground) };
  }
}

export function getLinkColor(
  linkState: 'regular' | 'highlighted' | 'lessened',
  sourceType: string,
  targetType: string,
  style: ResolvedStyle
): string {
  switch (linkState) {
    case 'regular':
      if (sourceType === 'tag' && targetType === 'tag') {
        return getNodeTypeColor('tag', style);
      }
      return style.lineColor;
    case 'highlighted':
      return style.highlightedForeground;
    case 'lessened':
      return hsl(style.lineColor).copy({ opacity: 0.5 }).toString();
  }
}

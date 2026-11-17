import { scaleLinear } from 'd3-scale';
import type { NodeStyle } from '../protocol';
import type { GraphModelNode, ResolvedStyle } from './types';

export type NodeShape = NonNullable<NodeStyle['shape']>;

const radiusByLinkCount = scaleLinear()
  .domain([0, 30])
  .range([0.6, 3])
  .clamp(true);

/** The radius a node is drawn at, in graph units. */
export function getNodeRadius(
  node: GraphModelNode,
  style: ResolvedStyle,
  sizeMultiplier: number
): number {
  const size =
    style.nodeStyle[node.type]?.size ??
    radiusByLinkCount(node.neighbors.length);
  return size * sizeMultiplier;
}

/** How far from its centre a shape drawn at `radius` reaches, straight down. */
export function getShapeExtent(shape: NodeShape, radius: number): number {
  return shape === 'diamond' ? radius * Math.SQRT2 : radius;
}

/** Adds the shape centred on (x, y) to the context's current path. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: NodeShape,
  x: number,
  y: number,
  radius: number
) {
  if (shape === 'diamond') {
    const extent = getShapeExtent(shape, radius);
    ctx.moveTo(x, y - extent);
    ctx.lineTo(x + extent, y);
    ctx.lineTo(x, y + extent);
    ctx.lineTo(x - extent, y);
    ctx.closePath();
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
}

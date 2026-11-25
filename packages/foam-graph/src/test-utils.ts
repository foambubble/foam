import { render, type TemplateResult } from 'lit';

import type { GraphData } from './protocol';
import type { GraphModelNode, ResolvedStyle } from './lib/types';
import { getNodeFillAndBorder } from './lib/colors';

/**
 * The static markup a rendered template tree produces, nested templates
 * and arrays of templates included — enough to assert which elements a
 * render drew. Bound values are left out, since a `.prop=${}` binding
 * never reaches the markup.
 */
export const renderedMarkup = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(renderedMarkup).join('');
  if (value == null || typeof value !== 'object' || !('strings' in value)) {
    return '';
  }
  const { strings, values } = value as TemplateResult;
  return strings
    .map((part, index) => part + renderedMarkup(values[index]))
    .join('');
};

/**
 * The elements a rendered template draws, in a container outside the
 * document: the template's event bindings are live, while the custom
 * elements it names stay undrawn, so rendering the graph does not start a
 * force simulation. Pass the container back to render into it again, as a
 * component re-render does, keeping the elements Lit reuses.
 */
export const renderedElements = (
  value: unknown,
  into: HTMLElement = document.createElement('div')
): HTMLElement => {
  render(value as TemplateResult, into);
  return into;
};

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
  nodeStyle: {},
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

export type RecordedShape =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'diamond'; x: number; y: number; extent: number }
  | { kind: 'square'; x: number; y: number; half: number };

export interface Drawing {
  op: 'fill' | 'stroke';
  color: string;
  lineDash: number[];
  shapes: RecordedShape[];
}

/**
 * A 2D context that keeps what is filled and stroked, as circles, diamonds
 * (four-point polygons starting at a tip) and squares (four-point polygons
 * starting at a corner), since happy-dom's canvas draws nothing.
 */
export class RecordingContext {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = '';
  textBaseline = '';
  readonly drawings: Drawing[] = [];
  private lineDash: number[] = [];
  private shapes: RecordedShape[] = [];
  private points: Array<{ x: number; y: number }> = [];

  beginPath() {
    this.shapes = [];
    this.points = [];
  }
  moveTo(x: number, y: number) {
    this.endPolygon();
    this.points = [{ x, y }];
  }
  lineTo(x: number, y: number) {
    this.points.push({ x, y });
  }
  closePath() {
    this.endPolygon();
  }
  arc(x: number, y: number, radius: number) {
    this.points = [];
    this.shapes.push({ kind: 'circle', x, y, radius });
  }
  fill() {
    this.record('fill', this.fillStyle);
  }
  stroke() {
    this.record('stroke', this.strokeStyle);
  }
  setLineDash(segments: number[]) {
    this.lineDash = [...segments];
  }
  getTransform() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as DOMMatrix;
  }
  save() {}
  restore() {}
  setTransform() {}
  fillText() {}

  private record(op: Drawing['op'], color: string) {
    this.endPolygon();
    this.drawings.push({
      op,
      color,
      lineDash: [...this.lineDash],
      shapes: [...this.shapes],
    });
  }

  private endPolygon() {
    if (this.points.length === 4) {
      const x = this.points.reduce((sum, p) => sum + p.x, 0) / 4;
      const y = this.points.reduce((sum, p) => sum + p.y, 0) / 4;
      const dx = Math.abs(this.points[0].x - x);
      const dy = Math.abs(this.points[0].y - y);
      this.shapes.push(
        dx > 1e-9 && dy > 1e-9
          ? { kind: 'square', x, y, half: dx }
          : { kind: 'diamond', x, y, extent: Math.hypot(dx, dy) }
      );
    }
    this.points = [];
  }
}

/** The drawings with a shape centred on (x, y). */
export const drawingsAt = (ctx: RecordingContext, x: number, y: number) =>
  ctx.drawings
    .map(drawing => ({
      ...drawing,
      shapes: drawing.shapes.filter(
        s => Math.abs(s.x - x) < 1e-9 && Math.abs(s.y - y) < 1e-9
      ),
    }))
    .filter(drawing => drawing.shapes.length > 0);

/** Whether (x, y) lies inside a shape filled in `color`. */
export const isFilledAt = (
  ctx: RecordingContext,
  color: string,
  x: number,
  y: number
) =>
  ctx.drawings.some(
    drawing =>
      drawing.op === 'fill' &&
      drawing.color === color &&
      drawing.shapes.some(s =>
        s.kind === 'circle'
          ? Math.hypot(x - s.x, y - s.y) <= s.radius
          : s.kind === 'square'
          ? Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) <= s.half
          : Math.abs(x - s.x) + Math.abs(y - s.y) <= s.extent
      )
  );

export const fillOf = (
  node: GraphModelNode,
  mode: ResolvedStyle['colorMode'],
  style = makeStyle()
) => getNodeFillAndBorder(node, 'regular', style, mode).fill.toString();

import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  computeFitZoom,
  computeLabelOpacity,
  computeLabelFontSize,
  graphPointToViewport,
  measureGraphViewport,
  GraphCanvas,
} from './graph-canvas';
import {
  RecordingContext,
  blankContext,
  drawingsAt,
  isFilledAt,
  makeNode,
  makeStyle,
} from '../test-utils';
import { getDefaultStyle } from '../lib/defaults';
import type {
  GraphModelNode,
  LinkAnimation,
  NodeState,
  ResolvedStyle,
} from '../lib/types';
import type { VisibleGraph } from '../lib/graph-view-model';

type PlacedNode = GraphModelNode & { x: number; y: number };

const place = (
  overrides: Partial<GraphModelNode>,
  x = 0,
  y = 0
): PlacedNode => ({ ...makeNode(overrides), x, y });

const makeCanvas = (
  nodes: PlacedNode[],
  options: {
    style?: ResolvedStyle;
    states?: Record<string, NodeState>;
    nodeSizeMultiplier?: number;
    minTapSize?: number;
  } = {}
) => {
  const canvas = new GraphCanvas();
  canvas.style = options.style ?? makeStyle();
  canvas.nodeSizeMultiplier = options.nodeSizeMultiplier ?? 1;
  canvas.minTapSize = options.minTapSize ?? null;
  canvas.graphStates = {
    nodeStates: new Map(Object.entries(options.states ?? {})),
    linkStates: new Map(),
  };
  canvas.visibleGraph = {
    nodeInfo: Object.fromEntries(nodes.map(node => [node.id, node])),
    nodes: nodes.map(node => ({ id: node.id })),
    links: [],
  };
  (canvas as any).updated(
    new Map(
      [
        'style',
        'graphStates',
        'visibleGraph',
        'nodeSizeMultiplier',
        'minTapSize',
      ].map(key => [key, null])
    )
  );
  return canvas;
};

/** Paints `nodes` as one frame does, onto a recording context. */
const paint = (
  nodes: PlacedNode[],
  options: Parameters<typeof makeCanvas>[1] = {}
) => {
  const canvas = makeCanvas(nodes, options);
  const ctx = new RecordingContext();
  for (const node of nodes) {
    (canvas as any).paintNode({ id: node.id, x: node.x, y: node.y }, ctx, 1);
  }
  (canvas as any).painter.paint(ctx);
  return ctx;
};

const shapeKindsAt = (ctx: RecordingContext, x: number, y: number) => [
  ...new Set(
    drawingsAt(ctx, x, y).flatMap(drawing => drawing.shapes.map(s => s.kind))
  ),
];

describe('measureGraphViewport', () => {
  it('uses the graph element size instead of the browser viewport', () => {
    const element = document.createElement('foam-graph-canvas');
    element.getBoundingClientRect = () =>
      ({
        width: 320,
        height: 180,
      } as DOMRect);

    expect(measureGraphViewport(element, { width: 1200, height: 900 })).toEqual(
      {
        width: 320,
        height: 180,
      }
    );
  });

  it('falls back to the parent element size before the browser viewport', () => {
    const parent = document.createElement('foam-graph');
    const element = document.createElement('foam-graph-canvas');
    parent.append(element);
    element.getBoundingClientRect = () =>
      ({
        width: 0,
        height: 0,
      } as DOMRect);
    parent.getBoundingClientRect = () =>
      ({
        width: 240,
        height: 160,
      } as DOMRect);

    expect(measureGraphViewport(element, { width: 1200, height: 900 })).toEqual(
      {
        width: 240,
        height: 160,
      }
    );
  });
});

describe('computeLabelFontSize', () => {
  it('keeps label font size independent from graph zoom', () => {
    expect(computeLabelFontSize(12, 1)).toBe(12);
  });

  it('applies the configured label size multiplier', () => {
    expect(computeLabelFontSize(12, 1.5)).toBe(18);
  });
});

describe('computeLabelOpacity', () => {
  it('keeps labels fully visible when always-show labels is enabled', () => {
    expect(computeLabelOpacity('regular', 0.5, 0.4, () => 0, 'always')).toBe(1);
  });

  it('preserves regular zoom-dependent label fading by default', () => {
    expect(
      computeLabelOpacity('regular', 0.5, 0.4, () => 0.25, { fade: 0 })
    ).toBe(0.25);
  });

  it('keeps highlighted labels fully visible by default', () => {
    expect(
      computeLabelOpacity('highlighted', 0.5, 0.4, () => 0, { fade: 0 })
    ).toBe(1);
  });
});

describe('graphPointToViewport', () => {
  it('converts graph coordinates through the current canvas transform', () => {
    const transform = {
      a: 2,
      b: 0,
      c: 0,
      d: 2,
      e: 20,
      f: 30,
    } as DOMMatrixReadOnly;

    expect(graphPointToViewport(transform, 10, 15, 1)).toEqual({
      x: 40,
      y: 60,
    });
  });

  it('returns CSS pixel coordinates when the canvas is scaled for device pixels', () => {
    const transform = {
      a: 4,
      b: 0,
      c: 0,
      d: 4,
      e: 40,
      f: 60,
    } as DOMMatrixReadOnly;

    expect(graphPointToViewport(transform, 10, 15, 2)).toEqual({
      x: 40,
      y: 60,
    });
  });
});

describe('computeFitZoom', () => {
  it('computes the zoom needed to fit bounds into the viewport', () => {
    expect(
      computeFitZoom(
        { x: [0, 100], y: [0, 50] },
        { width: 220, height: 120 },
        10
      )
    ).toBe(2);
  });

  it('caps the fit zoom when a max zoom is provided', () => {
    expect(
      computeFitZoom(
        { x: [0, 100], y: [0, 50] },
        { width: 220, height: 120 },
        10,
        1.4
      )
    ).toBe(1.4);
  });

  it('does not increase a smaller fit zoom to the cap', () => {
    expect(
      computeFitZoom(
        { x: [0, 200], y: [0, 100] },
        { width: 220, height: 120 },
        10,
        1.4
      )
    ).toBe(1);
  });
});

// AC-4, canvas path: labels reflect a changed truncation length because the
// cache the paint loop reads is rebuilt on labelMaxLength changes
describe('label cache', () => {
  const longTitle = 'a'.repeat(30);
  const makeVisibleGraph = () =>
    ({
      nodeInfo: {
        n1: {
          id: 'n1',
          type: 'note',
          title: longTitle,
          properties: {},
          tags: [],
          neighbors: [],
          links: [],
        },
      },
      nodes: [{ id: 'n1' }],
      links: [],
    } as any);

  it('truncates labels when graph data arrives', () => {
    const canvas = new GraphCanvas();
    canvas.visibleGraph = makeVisibleGraph();

    (canvas as any).updated(new Map([['visibleGraph', null]]));

    expect((canvas as any).rs.labelByNodeId.n1).toBe('a'.repeat(24) + '...');
  });

  it('rebuilds labels when only the truncation length changes', () => {
    const canvas = new GraphCanvas();
    canvas.visibleGraph = makeVisibleGraph();
    (canvas as any).updated(new Map([['visibleGraph', null]]));

    canvas.labelMaxLength = 10;
    (canvas as any).updated(new Map([['labelMaxLength', null]]));

    expect((canvas as any).rs.labelByNodeId.n1).toBe('a'.repeat(10) + '...');
  });

  it('keeps the full title in the graph model', () => {
    const canvas = new GraphCanvas();
    canvas.visibleGraph = makeVisibleGraph();

    (canvas as any).updated(new Map([['visibleGraph', null]]));

    expect((canvas as any).rs.nodeInfo.n1.title).toBe(longTitle);
  });
});

describe('node shapes (AC-1)', () => {
  it('draws the nodes of a type styled as diamonds as diamonds, and every other node as a circle', () => {
    const note = place({ id: 'n', type: 'note' }, 0, 0);
    const tag = place({ id: 't', type: 'tag' }, 100, 0);
    const style = makeStyle({ nodeStyle: { tag: { shape: 'diamond' } } });

    const ctx = paint([note, tag], { style });

    expect(shapeKindsAt(ctx, 100, 0)).toEqual(['diamond']);
    expect(shapeKindsAt(ctx, 0, 0)).toEqual(['circle']);
  });

  it('draws every node as a circle when no shape is set', () => {
    const note = place({ id: 'n', type: 'note' }, 0, 0);
    const tag = place({ id: 't', type: 'tag' }, 100, 0);

    const ctx = paint([note, tag]);

    expect(shapeKindsAt(ctx, 0, 0)).toEqual(['circle']);
    expect(shapeKindsAt(ctx, 100, 0)).toEqual(['circle']);
  });
});

describe('default node styles', () => {
  it('draws notes as filled circles, tags as filled diamonds, placeholders as dashed outlines, and attachments and images as solid outlines', () => {
    const nodes = ['note', 'tag', 'placeholder', 'attachment', 'image'].map(
      (type, i) => place({ id: type, type }, i * 100, 0)
    );
    const ctx = paint(nodes, { style: getDefaultStyle() });
    const drawnAs = (node: PlacedNode) => {
      const drawings = drawingsAt(ctx, node.x, node.y);
      const stroke = drawings.find(d => d.op === 'stroke');
      return {
        type: node.type,
        shape: drawings[0].shapes[0].kind,
        outline: !stroke ? 'none' : stroke.lineDash.length ? 'dashed' : 'solid',
      };
    };

    expect(nodes.map(drawnAs)).toEqual([
      { type: 'note', shape: 'circle', outline: 'none' },
      { type: 'tag', shape: 'diamond', outline: 'none' },
      { type: 'placeholder', shape: 'circle', outline: 'dashed' },
      { type: 'attachment', shape: 'circle', outline: 'solid' },
      { type: 'image', shape: 'circle', outline: 'solid' },
    ]);
  });

  it('draws tags, placeholders, attachments and images at one size whatever their link count', () => {
    const style = getDefaultStyle();
    const sizeOf = (type: string, links: number) => {
      const node = place({ id: 'n', type, neighbors: Array(links).fill('x') });
      const [shape] = drawingsAt(paint([node], { style }), 0, 0)[0].shapes;
      return shape.kind === 'circle'
        ? shape.radius
        : shape.kind === 'square'
        ? shape.half
        : shape.extent;
    };

    for (const type of ['tag', 'placeholder', 'attachment', 'image']) {
      expect(sizeOf(type, 20)).toBe(sizeOf(type, 0));
    }
  });

  // AC-8 (#452)
  it('draws folders as squares of one size, whatever they hold', () => {
    const holding = (count: number, x: number) =>
      place(
        { id: `holds-${count}`, type: 'folder', neighbors: Array(count).fill('x') },
        x,
        0
      );
    const ctx = paint([holding(1, 0), holding(200, 100)], {
      style: getDefaultStyle(),
    });
    const squareSizesAt = (x: number) =>
      drawingsAt(ctx, x, 0).flatMap(drawing =>
        drawing.shapes.map(shape => (shape.kind === 'square' ? shape.half : NaN))
      );

    const small = squareSizesAt(0);
    const large = squareSizesAt(100);
    expect(small.length).toBeGreaterThan(0);
    expect(small.every(half => half > 0)).toBe(true);
    expect(large).toHaveLength(small.length);
    large.forEach((half, i) => expect(half).toBeCloseTo(small[i]));
  });
});

describe('node outlines (AC-2)', () => {
  const placeholder = place({ id: 'p', type: 'placeholder' });
  const placeholderColor = 'rgb(51, 51, 51)';
  const backgroundColor = 'rgb(32, 32, 32)';

  it('draws an outlined type as its outline in the type colour, filled with the background', () => {
    const style = makeStyle({
      nodeStyle: { placeholder: { outline: 'solid' } },
    });

    const drawings = drawingsAt(paint([placeholder], { style }), 0, 0);

    expect(
      drawings
        .filter(d => d.op === 'stroke')
        .map(d => ({ color: d.color, lineDash: d.lineDash }))
    ).toEqual([{ color: placeholderColor, lineDash: [] }]);
    expect(drawings.filter(d => d.op === 'fill').map(d => d.color)).toEqual([
      backgroundColor,
    ]);
  });

  it('dashes the outline of a type styled dashed', () => {
    const style = makeStyle({
      nodeStyle: { placeholder: { outline: 'dashed' } },
    });

    const drawings = drawingsAt(paint([placeholder], { style }), 0, 0);
    const outline = drawings.find(d => d.op === 'stroke');

    expect(outline?.color).toBe(placeholderColor);
    expect(outline?.lineDash.length).toBeGreaterThan(0);
  });

  it('fills nodes in their type colour when no outline is set', () => {
    const drawings = drawingsAt(paint([placeholder]), 0, 0);

    expect(drawings.map(d => ({ op: d.op, color: d.color }))).toEqual([
      { op: 'fill', color: placeholderColor },
    ]);
  });
});

describe('node sizes (AC-3, canvas path)', () => {
  it('draws a node at its type fixed size, scaled by the node size multiplier', () => {
    const style = makeStyle({ nodeStyle: { note: { size: 4 } } });
    const note = place({ id: 'n', type: 'note', neighbors: [] });

    const [drawing] = drawingsAt(
      paint([note], { style, nodeSizeMultiplier: 2 }),
      0,
      0
    );
    const [circle] = drawing.shapes;

    expect(circle.kind === 'circle' && circle.radius).toBeCloseTo(8, 0);
  });
});

describe('node states (AC-4)', () => {
  it('keeps a styled node shape, outline and size when it is highlighted or dimmed, and changes only its colour', () => {
    const style = makeStyle({
      nodeStyle: { tag: { shape: 'diamond', outline: 'dashed', size: 4 } },
    });
    const tag = place({ id: 't', type: 'tag' });
    const outlineIn = (state: NodeState) =>
      drawingsAt(paint([tag], { style, states: { t: state } }), 0, 0).find(
        d => d.op === 'stroke'
      );

    const regular = outlineIn('regular');
    const highlighted = outlineIn('highlighted');
    const lessened = outlineIn('lessened');

    expect(regular?.shapes.map(s => s.kind)).toEqual(['diamond']);
    for (const outline of [highlighted, lessened]) {
      expect(outline?.shapes).toEqual(regular?.shapes);
      expect(outline?.lineDash).toEqual(regular?.lineDash);
    }
    expect([regular?.color, highlighted?.color, lessened?.color]).toEqual([
      'rgb(255, 255, 0)',
      'rgb(255, 255, 255)',
      'rgba(255, 255, 0, 0.05)',
    ]);
  });
});

describe('tap size (AC-5)', () => {
  const hitColor = '#010203';
  const hitArea = (
    node: PlacedNode,
    options: { style?: ResolvedStyle; minTapSize?: number; zoom: number }
  ) => {
    const canvas = makeCanvas([node], options);
    const ctx = new RecordingContext();
    (canvas as any).paintHitArea(
      { id: node.id, x: node.x, y: node.y },
      hitColor,
      ctx,
      options.zoom
    );
    return ctx;
  };

  it.each([0.5, 1, 4])(
    'hits a small node from within half the minimum tap size of its centre, at zoom %s',
    zoom => {
      const ctx = hitArea(place({ id: 'n' }), { minTapSize: 44, zoom });

      expect(isFilledAt(ctx, hitColor, 21 / zoom, 0)).toBe(true);
      expect(isFilledAt(ctx, hitColor, 0, -21 / zoom)).toBe(true);
      expect(isFilledAt(ctx, hitColor, 23 / zoom, 0)).toBe(false);
    }
  );

  it('keeps the drawn area of a node larger than the minimum tap size', () => {
    const style = makeStyle({ nodeStyle: { note: { size: 40 } } });

    const ctx = hitArea(place({ id: 'n', type: 'note' }), {
      style,
      minTapSize: 44,
      zoom: 1,
    });

    expect(isFilledAt(ctx, hitColor, 39, 0)).toBe(true);
  });

  it('keeps the drawn area of a diamond larger than the minimum tap size', () => {
    const style = makeStyle({
      nodeStyle: { note: { shape: 'diamond', size: 40 } },
    });

    const ctx = hitArea(place({ id: 'n', type: 'note' }), {
      style,
      minTapSize: 44,
      zoom: 1,
    });

    // inside the diamond's corner, outside both the tap circle and a circle of radius 40
    expect(isFilledAt(ctx, hitColor, 0, 50)).toBe(true);
  });

  it('hits a diamond within its drawn shape', () => {
    const style = makeStyle({
      nodeStyle: { note: { shape: 'diamond', size: 10 } },
    });

    const ctx = hitArea(place({ id: 'n', type: 'note' }), { style, zoom: 1 });

    expect(isFilledAt(ctx, hitColor, 0, 13)).toBe(true);
    expect(isFilledAt(ctx, hitColor, 9, 9)).toBe(false);
  });

  it('hits only the drawn node when no minimum is set', () => {
    const ctx = hitArea(place({ id: 'n', neighbors: [] }), { zoom: 1 });

    expect(isFilledAt(ctx, hitColor, 0.5, 0)).toBe(true);
    expect(isFilledAt(ctx, hitColor, 1, 0)).toBe(false);
  });
});

describe('graph data set after the canvas is created', () => {
  const graphOf = (links: Array<[string, string]>): VisibleGraph => {
    const ids = [...new Set(links.flat())];
    return {
      nodeInfo: Object.fromEntries(
        ids.map(id => [id, makeNode({ id, title: id })])
      ),
      nodes: ids.map(id => ({ id })),
      links: links.map(([source, target]) => ({ source, target })),
    };
  };

  /** A canvas in the document, its force graph created and running. */
  const mountCanvas = async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => blankContext() as any);
    const canvas = new GraphCanvas();
    canvas.style = makeStyle();
    document.body.append(canvas);
    onTestFinished(() => {
      canvas.remove();
      getContext.mockRestore();
    });
    await canvas.updateComplete;
    return canvas;
  };

  it('lays out a graph set as soon as the canvas is created, and fits it once the layout stops', async () => {
    const canvas = await mountCanvas();
    const fit = vi.spyOn(canvas, 'zoomToFit');

    canvas.visibleGraph = graphOf([
      ['a', 'b'],
      ['b', 'c'],
    ]);

    await expect(canvas.updateComplete).resolves.toBe(true);
    expect(fit).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fit).toHaveBeenCalledOnce());
  });

  it('fits a later graph once its layout stops, when asked to', async () => {
    const canvas = await mountCanvas();
    const fit = vi.spyOn(canvas, 'zoomToFit');
    canvas.visibleGraph = graphOf([['a', 'b']]);
    await canvas.updateComplete;
    await vi.waitFor(() => expect(fit).toHaveBeenCalledOnce());

    canvas.visibleGraph = graphOf([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    await expect(canvas.updateComplete).resolves.toBe(true);
    canvas.fitWhenSettled();

    expect(fit).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(fit).toHaveBeenCalledTimes(2));
  });
});

describe('link particles', () => {
  const canvasWith = (animateLinks: LinkAnimation) => {
    const canvas = new GraphCanvas();
    canvas.animateLinks = animateLinks;
    canvas.graphStates = {
      nodeStates: new Map(),
      linkStates: new Map([
        ['a->b', 'highlighted'],
        ['b->c', 'regular'],
      ]),
    };
    (canvas as any).updated(
      new Map([
        ['animateLinks', null],
        ['graphStates', null],
      ])
    );
    return canvas;
  };
  const particles = (canvas: GraphCanvas, source: string, target: string) =>
    (canvas as any).particlesOnLink({ source, target });

  it('runs a particle only along highlighted links while links animate', () => {
    const canvas = canvasWith('forward');

    expect(particles(canvas, 'a', 'b')).toBe(1);
    expect(particles(canvas, 'b', 'c')).toBe(0);
  });

  it('runs no particle along any link when link animation is off', () => {
    expect(particles(canvasWith('off'), 'a', 'b')).toBe(0);
  });
});

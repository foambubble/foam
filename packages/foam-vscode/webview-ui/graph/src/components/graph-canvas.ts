import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import ForceGraph from 'force-graph';
import {
  forceX,
  forceY,
  forceCollide,
  forceManyBody,
  forceLink,
} from 'd3-force';
import { scaleLinear } from 'd3-scale';
import { Painter } from '../lib/painter';
import {
  getNodeFillAndBorder,
  getLinkColor,
  getNodeLabelColor,
} from '../lib/colors';
import { GraphModelLink } from '../lib/types';
import type {
  GraphStates,
  ResolvedStyle,
  Forces,
  Labels,
  LinkAnimation,
} from '../lib/types';
import type { GroupRule } from '../protocol';
import type { VisibleGraph } from '../lib/graph-view-model';

export interface GraphViewportSize {
  width: number;
  height: number;
}

export interface ViewportPoint {
  x: number;
  y: number;
}

export interface GraphBounds {
  x: [number, number];
  y: [number, number];
}

export function measureGraphViewport(
  element: HTMLElement,
  fallback: GraphViewportSize
): GraphViewportSize {
  const rect = element.getBoundingClientRect();
  const parent = element.parentElement;
  const parentRect = parent?.getBoundingClientRect();
  return {
    width:
      rect.width ||
      element.clientWidth ||
      parentRect?.width ||
      parent?.clientWidth ||
      fallback.width,
    height:
      rect.height ||
      element.clientHeight ||
      parentRect?.height ||
      parent?.clientHeight ||
      fallback.height,
  };
}

export function graphPointToViewport(
  transform: DOMMatrixReadOnly,
  x: number,
  y: number,
  devicePixelRatio: number
): ViewportPoint {
  const ratio = devicePixelRatio || 1;
  return {
    x: (transform.a * x + transform.c * y + transform.e) / ratio,
    y: (transform.b * x + transform.d * y + transform.f) / ratio,
  };
}

export function computeLabelFontSize(
  baseFontSize: number,
  multiplier: number
): number {
  return baseFontSize * multiplier;
}

export function computeLabelOpacity(
  state: string,
  globalScale: number,
  fillOpacity: number,
  getOpacity: (scale: number) => number,
  labels: Labels
): number {
  if (labels === 'always' || state === 'highlighted') return 1;
  const opacity = getOpacity(globalScale);
  return state === 'regular' ? opacity : Math.min(opacity, fillOpacity);
}

export function computeFitZoom(
  bounds: GraphBounds,
  viewport: GraphViewportSize,
  padding: number,
  maxZoom?: number | null
): number {
  const availableWidth = Math.max(viewport.width - padding * 2, 1);
  const availableHeight = Math.max(viewport.height - padding * 2, 1);
  const graphWidth = Math.max(bounds.x[1] - bounds.x[0], 1e-12);
  const graphHeight = Math.max(bounds.y[1] - bounds.y[0], 1e-12);
  const fitZoom = Math.max(
    1e-12,
    Math.min(1e12, availableWidth / graphWidth, availableHeight / graphHeight)
  );
  return maxZoom == null ? fitZoom : Math.min(fitZoom, maxZoom);
}

@customElement('foam-graph-canvas')
export class GraphCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }

    #canvas-container {
      width: 100%;
      height: 100%;
    }
  `;

  /**
   * Pre-filtered graph data ready for rendering. `nodeInfo` should contain only
   * visible nodes.
   */
  @property({ type: Object }) visibleGraph: VisibleGraph | null = null;
  @property({ type: Object }) graphStates: GraphStates | null = null;
  @property({ type: Object }) style: ResolvedStyle = {} as ResolvedStyle;
  @property({ type: Object }) forces: Forces = {
    collide: 2,
    repel: 30,
    link: 30,
    velocityDecay: 0.4,
  };
  @property({ type: Object }) labels: Labels = { fade: 0 };
  @property({ type: Number }) nodeFontSizeMultiplier: number = 1;
  @property({ type: Number }) nodeSizeMultiplier: number = 1;
  @property({ type: Number }) linkWidthMultiplier: number = 2;
  @property({ type: String }) animateLinks: LinkAnimation = 'forward';
  @property({ type: Array }) groups: GroupRule[] = [];
  @property({ type: Number }) maxFitZoom: number | null = null;

  // Mutable rendering state closed over by force-graph callbacks.
  private rs = {
    nodeInfo: {} as VisibleGraph['nodeInfo'],
    data: { nodes: [] as { id: string }[], links: [] as GraphModelLink[] },
    graphStates: null as GraphStates | null,
    style: {} as ResolvedStyle,
    forces: {} as Forces,
    nodeFontSizeMultiplier: 1,
    nodeSizeMultiplier: 1,
    linkWidthMultiplier: 2,
    animateLinks: 'forward' as LinkAnimation,
    colorMode: 'type' as 'none' | 'directory' | 'type',
    groups: [] as GroupRule[],
  };

  private readonly getNodeSize = scaleLinear()
    .domain([0, 30])
    .range([0.6, 3])
    .clamp(true);
  private readonly getNodeLabelOpacity = scaleLinear()
    .domain([1.2, 2.0])
    .range([0, 1])
    .clamp(true);

  private graphInstance: ReturnType<ReturnType<typeof ForceGraph>> | null =
    null;
  private firstGraphLoad = true;
  private resizeObserver: ResizeObserver | null = null;
  private readonly onResize = () => this.resizeGraphToViewport();

  render() {
    return html`<div id="canvas-container"></div>`;
  }

  firstUpdated() {
    const container = this.shadowRoot!.getElementById(
      'canvas-container'
    ) as HTMLDivElement;
    container.addEventListener('mouseleave', () => {
      this._emit('canvas-node-hover', null);
    });
    const painter = new Painter();

    this.graphInstance = ForceGraph()(container)
      .graphData(this.rs.data as any)
      .backgroundColor(this.rs.style.background || '#202020')
      .linkHoverPrecision(8)
      .d3Force('x', forceX())
      .d3Force('y', forceY())
      .d3Force(
        'collide',
        forceCollide(4 /* default nodeRelSize */ * this.rs.forces.collide || 8)
      )
      .d3Force(
        'charge',
        forceManyBody().strength(-(this.rs.forces.repel || 30))
      )
      .d3Force(
        'link',
        forceLink(this.rs.data.links as any).distance(this.rs.forces.link || 30)
      )
      .d3VelocityDecay(1 - (this.rs.forces.velocityDecay ?? 0.4))
      .linkWidth(() => this.rs.style.lineWidth * this.rs.linkWidthMultiplier)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleSpeed(
        this.rs.animateLinks === 'reverse' ? -0.004 : 0.004
      )
      .linkDirectionalParticleWidth(link => {
        if (this.rs.animateLinks === 'off') return 0;
        const graphLink = link as GraphModelLink;
        const key = GraphModelLink.getKey(graphLink);
        const state = this.rs.graphStates?.linkStates.get(key) ?? 'regular';
        return state === 'highlighted' ? this.rs.style.particleWidth : 0;
      })
      .nodeCanvasObject(
        (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const info = this.rs.nodeInfo[node.id];
          if (!info) return;

          const size =
            this.getNodeSize(info.neighbors.length) *
            this.rs.nodeSizeMultiplier;
          const state =
            this.rs.graphStates?.nodeStates.get(node.id) ?? 'regular';
          const { fill, border } = getNodeFillAndBorder(
            info,
            state,
            this.rs.style,
            this.rs.colorMode,
            this.rs.groups
          );
          const fontSize = computeLabelFontSize(
            this.rs.style.fontSize,
            this.rs.nodeFontSizeMultiplier
          );
          const opacity = computeLabelOpacity(
            state,
            globalScale,
            fill.opacity,
            scale => this.getNodeLabelOpacity(scale),
            this.labels
          );

          const textColor = getNodeLabelColor(
            fill,
            state,
            opacity,
            this.rs.style
          );

          const labelPosition = graphPointToViewport(
            ctx.getTransform(),
            node.x,
            node.y + size + 1,
            window.devicePixelRatio || 1
          );

          painter
            .circle(node.x, node.y, size, fill, border)
            .screenText(
              info.title,
              labelPosition.x,
              labelPosition.y,
              fontSize,
              this.rs.style.fontFamily,
              textColor as any
            );
        }
      )
      .onRenderFramePost((ctx: CanvasRenderingContext2D) => {
        painter.paint(ctx);
      })
      .linkColor((link: any) => {
        const graphLink = link as GraphModelLink;
        const key = GraphModelLink.getKey(graphLink);
        const state = this.rs.graphStates?.linkStates.get(key) ?? 'regular';
        const srcInfo =
          this.rs.nodeInfo[GraphModelLink.getNodeId(graphLink.source)];
        const tgtInfo =
          this.rs.nodeInfo[GraphModelLink.getNodeId(graphLink.target)];
        return getLinkColor(
          state,
          srcInfo?.type ?? 'note',
          tgtInfo?.type ?? 'note',
          this.rs.style
        );
      })
      .nodePointerAreaPaint(
        (node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const info = this.rs.nodeInfo[node.id];
          if (!info) return;
          const size =
            this.getNodeSize(info.neighbors.length) *
            this.rs.nodeSizeMultiplier;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
          ctx.fill();
        }
      )
      .onNodeHover((node: any) => {
        const nodeId = node?.id ?? null;
        this._emit('canvas-node-hover', nodeId);
        container.style.cursor = node ? 'pointer' : 'default';
      })
      .onNodeClick((node: any, event: MouseEvent) => {
        this._emit('canvas-node-click', {
          nodeId: node.id,
          append: event.getModifierState('Shift'),
        });
      })
      .onBackgroundClick((event: MouseEvent) => {
        this._emit('canvas-background-click', {
          append: event.getModifierState('Shift'),
        });
      });

    this.resizeGraphToViewport();
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() =>
        this.resizeGraphToViewport()
      );
      this.resizeObserver.observe(this);
    }
    window.addEventListener('resize', this.onResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.onResize);
    (this.graphInstance as any)?._destructor?.();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('style')) {
      this.rs.style = this.style;
      this.rs.colorMode = this.style.colorMode;
      this.graphInstance?.backgroundColor(this.style.background);
    }

    if (changed.has('graphStates')) {
      this.rs.graphStates = this.graphStates;
    }

    if (changed.has('forces')) {
      this.rs.forces = this.forces;
      if (this.graphInstance) {
        (this.graphInstance.d3Force('collide') as any)?.radius(
          this.graphInstance.nodeRelSize() * this.forces.collide
        );
        (this.graphInstance.d3Force('charge') as any)?.strength(
          -this.forces.repel
        );
        (this.graphInstance.d3Force('link') as any)?.distance(this.forces.link);
        this.graphInstance.d3VelocityDecay(1 - this.forces.velocityDecay);
        this.graphInstance.d3ReheatSimulation();
      }
    }

    if (changed.has('groups')) {
      this.rs.groups = this.groups;
    }

    if (changed.has('labels')) {
      if (typeof this.labels === 'object') {
        const invertedValue = 3 - this.labels.fade;
        this.getNodeLabelOpacity.domain([invertedValue, invertedValue + 0.8]);
      }
    }

    if (changed.has('nodeFontSizeMultiplier')) {
      this.rs.nodeFontSizeMultiplier = this.nodeFontSizeMultiplier;
    }

    if (changed.has('nodeSizeMultiplier')) {
      this.rs.nodeSizeMultiplier = this.nodeSizeMultiplier;
    }

    if (changed.has('linkWidthMultiplier')) {
      this.rs.linkWidthMultiplier = this.linkWidthMultiplier;
      this.graphInstance?.linkWidth(
        () => this.rs.style.lineWidth * this.rs.linkWidthMultiplier
      );
    }

    if (changed.has('animateLinks')) {
      this.rs.animateLinks = this.animateLinks;
      this.graphInstance?.linkDirectionalParticleSpeed(
        this.animateLinks === 'reverse' ? -0.004 : 0.004
      );
    }

    if (changed.has('visibleGraph')) {
      const nextGraph: VisibleGraph = this.visibleGraph ?? {
        nodeInfo: {},
        nodes: [],
        links: [],
      };
      this.rs.nodeInfo = nextGraph.nodeInfo;
      this._updateGraphData(nextGraph);

      if (this.visibleGraph && this.firstGraphLoad && this.graphInstance) {
        this.firstGraphLoad = false;
        this.graphInstance.zoom(this.graphInstance.zoom() * 1.5);
        this.graphInstance.cooldownTicks(100);
        this.graphInstance.onEngineStop(() => {
          this.graphInstance!.onEngineStop(() => {});
          this.zoomToFit(500);
        });
      }
    }
  }

  /** Centers the viewport on a currently visible node. */
  centerOnNode(nodeId: string, zoom?: number, duration = 300) {
    if (!this.graphInstance) return;
    const nodes = this.graphInstance.graphData().nodes as any[];
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    this.graphInstance.centerAt(node.x, node.y, duration);
    if (zoom !== undefined) {
      this.graphInstance.zoom(zoom, duration);
    }
  }

  /** Fits the current graph into the available canvas area. */
  zoomToFit(duration = 500) {
    if (!this.graphInstance) return;
    if (this.maxFitZoom == null) {
      this.graphInstance.zoomToFit(duration);
      return;
    }

    const graphInstance = this.graphInstance as any;
    const bounds = graphInstance.getGraphBbox?.() as GraphBounds | null;
    if (!bounds) return;

    const center = {
      x: (bounds.x[0] + bounds.x[1]) / 2,
      y: (bounds.y[0] + bounds.y[1]) / 2,
    };
    const viewport = measureGraphViewport(this, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    const zoom = computeFitZoom(bounds, viewport, 10, this.maxFitZoom);

    this.graphInstance.centerAt(center.x, center.y, duration);
    this.graphInstance.zoom(zoom, duration);
  }

  /** Sets the current zoom level without changing the graph data. */
  zoom(zoom: number, duration = 300) {
    this.graphInstance?.zoom(zoom, duration);
  }

  private resizeGraphToViewport() {
    if (!this.graphInstance) return;
    const { width, height } = measureGraphViewport(this, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (width <= 0 || height <= 0) return;
    this.graphInstance.width(width).height(height);
  }

  private _updateGraphData(visibleGraph: VisibleGraph) {
    if (!this.graphInstance) return;

    const nodeIdsToAdd = new Set(visibleGraph.nodes.map(node => node.id));
    const nodeIdsToRemove = new Set<string>();

    for (const node of this.rs.data.nodes) {
      if (nodeIdsToAdd.has(node.id)) {
        nodeIdsToAdd.delete(node.id);
      } else {
        nodeIdsToRemove.add(node.id);
      }
    }

    for (const id of nodeIdsToRemove) {
      const idx = this.rs.data.nodes.findIndex(node => node.id === id);
      if (idx !== -1) this.rs.data.nodes.splice(idx, 1);
    }
    for (const id of nodeIdsToAdd) {
      this.rs.data.nodes.push({ id });
    }

    this.rs.data.links = visibleGraph.links.map(link => ({ ...link }));
    this.graphInstance.graphData(this.rs.data as any);
    (this.graphInstance.d3Force('link') as any)?.links(this.rs.data.links);
  }

  private _emit(eventName: string, detail: unknown) {
    this.dispatchEvent(
      new CustomEvent(eventName, { detail, bubbles: true, composed: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'foam-graph-canvas': GraphCanvas;
  }
}

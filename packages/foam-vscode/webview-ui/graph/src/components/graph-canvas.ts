import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import ForceGraph from 'force-graph';
import { forceX, forceY, forceCollide, forceManyBody, forceLink } from 'd3-force';
import { scaleLinear } from 'd3-scale';
import { Painter } from '../lib/painter';
import {
  computeFocusSets,
  getNodeState,
  getLinkState,
  getLinkNodeId,
} from '../lib/graph-utils';
import { getNodeFillAndBorder, getLinkColor } from '../lib/colors';
import type {
  AugmentedGraph,
  AugmentedLink,
  ResolvedStyle,
  Forces,
  Selection,
} from '../lib/types';

@customElement('foam-graph-canvas')
export class GraphCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
  `;

  @property({ type: Object }) augmentedGraph: AugmentedGraph | null = null;
  @property({ type: Object }) style: ResolvedStyle = {} as ResolvedStyle;
  @property({ type: Object }) showNodesOfType: Record<string, boolean> = {};
  @property({ type: Object }) forces: Forces = { collide: 2, repel: 30, link: 30, velocityDecay: 0.4 };
  @property({ type: Object }) selection: Selection = { neighborDepth: 1, enableRefocus: true, enableZoom: true };
  @property({ type: Number }) textFade: number = 3.8;
  @property({ type: Number }) nodeFontSizeMultiplier: number = 1;

  // Mutable rendering state — closed over by canvas callbacks
  private rs = {
    augmented: null as AugmentedGraph | null,
    data: { nodes: [] as { id: string }[], links: [] as AugmentedLink[] },
    selectedNodes: new Set<string>(),
    hoverNode: null as string | null,
    focusNodes: new Set<string>(),
    focusLinks: new Set<AugmentedLink>(),
    style: {} as ResolvedStyle,
    showNodesOfType: {} as Record<string, boolean>,
    forces: {} as Forces,
    selection: {} as Selection,
    textFade: 3.8,
    nodeFontSizeMultiplier: 1,
    colorMode: 'none' as 'none' | 'directory',
  };

  private readonly getNodeSize = scaleLinear().domain([0, 30]).range([0.5, 2]).clamp(true);
  private readonly getNodeLabelOpacity = scaleLinear().domain([1.2, 2.0]).range([0, 1]).clamp(true);

  private graphInstance: ReturnType<ReturnType<typeof ForceGraph>> | null = null;
  private firstGraphLoad = true;

  protected createRenderRoot() {
    // Use shadow DOM but pass through so the force-graph canvas fills the host
    return super.createRenderRoot();
  }

  render() {
    return html`<div id="canvas-container"></div>`;
  }

  firstUpdated() {
    const container = this.shadowRoot!.getElementById('canvas-container') as HTMLDivElement;
    const painter = new Painter();

    this.graphInstance = ForceGraph()(container)
      .graphData(this.rs.data as any)
      .backgroundColor(this.rs.style.background || '#202020')
      .linkHoverPrecision(8)
      .d3Force('x', forceX())
      .d3Force('y', forceY())
      .d3Force('collide', forceCollide(4 /* default nodeRelSize */ * this.rs.forces.collide || 8))
      .d3Force('charge', forceManyBody().strength(-(this.rs.forces.repel || 30)))
      .d3Force('link', forceLink(this.rs.data.links as any).distance(this.rs.forces.link || 30))
      .d3VelocityDecay(1 - (this.rs.forces.velocityDecay ?? 0.4))
      .linkWidth(() => this.rs.style.lineWidth)
      .linkDirectionalParticles(1)
      .linkDirectionalParticleWidth(link => {
        const state = getLinkState(
          link as AugmentedLink,
          this.rs.focusNodes,
          this.rs.focusLinks
        );
        return state === 'highlighted' ? this.rs.style.particleWidth : 0;
      })
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const info = this.rs.augmented?.nodeInfo[node.id];
        if (!info) return;

        const size = this.getNodeSize(info.neighbors.length);
        const state = getNodeState(
          node.id,
          this.rs.selectedNodes,
          this.rs.hoverNode,
          this.rs.focusNodes
        );
        const { fill, border } = getNodeFillAndBorder(
          info,
          state,
          this.rs.style,
          this.rs.colorMode
        );
        const fontSize =
          (this.rs.style.fontSize * this.rs.nodeFontSizeMultiplier) / globalScale;
        const opacity =
          state === 'highlighted'
            ? 1
            : state === 'regular'
              ? this.getNodeLabelOpacity(globalScale)
              : Math.min(this.getNodeLabelOpacity(globalScale), fill.opacity);

        const textColor = fill.copy({ opacity });

        painter
          .circle(node.x, node.y, size, fill, border)
          .text(
            info.title,
            node.x,
            node.y + size + 1,
            fontSize,
            this.rs.style.fontFamily,
            textColor as any
          );
      })
      .onRenderFramePost((ctx: CanvasRenderingContext2D) => {
        painter.paint(ctx);
      })
      .linkColor((link: any) => {
        const augLink = link as AugmentedLink;
        const state = getLinkState(augLink, this.rs.focusNodes, this.rs.focusLinks);
        const srcInfo = this.rs.augmented?.nodeInfo[getLinkNodeId(augLink.source)];
        const tgtInfo = this.rs.augmented?.nodeInfo[getLinkNodeId(augLink.target)];
        return getLinkColor(
          state,
          srcInfo?.type ?? 'note',
          tgtInfo?.type ?? 'note',
          this.rs.style
        );
      })
      .onNodeHover((node: any) => {
        this.rs.hoverNode = node?.id ?? null;
        this._updateFocusSets();
      })
      .onNodeClick((node: any, event: MouseEvent) => {
        const isAppend = event.getModifierState('Shift');
        this._selectNode(node.id, isAppend);
        this.dispatchEvent(new CustomEvent('node-click', { detail: node.id }));
      })
      .onBackgroundClick((event: MouseEvent) => {
        if (!event.getModifierState('Shift')) {
          this._selectNode(null, false);
        }
      });

    window.addEventListener('resize', () => {
      this.graphInstance?.width(window.innerWidth).height(window.innerHeight);
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    (this.graphInstance as any)?._destructor?.();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('style')) {
      this.rs.style = this.style;
      this.rs.colorMode = this.style.colorMode;
      this.graphInstance?.backgroundColor(this.style.background);
    }

    if (changed.has('showNodesOfType')) {
      this.rs.showNodesOfType = this.showNodesOfType;
      if (this.rs.augmented) this._updateGraphData();
    }

    if (changed.has('forces')) {
      this.rs.forces = this.forces;
      if (this.graphInstance) {
        (this.graphInstance.d3Force('collide') as any)?.radius(
          this.graphInstance.nodeRelSize() * this.forces.collide
        );
        (this.graphInstance.d3Force('charge') as any)?.strength(-this.forces.repel);
        (this.graphInstance.d3Force('link') as any)?.distance(this.forces.link);
        this.graphInstance.d3VelocityDecay(1 - this.forces.velocityDecay);
        this.graphInstance.d3ReheatSimulation();
      }
    }

    if (changed.has('selection')) {
      this.rs.selection = this.selection;
      this._updateFocusSets();
    }

    if (changed.has('textFade')) {
      this.rs.textFade = this.textFade;
      const invertedValue = 5 - this.textFade;
      this.getNodeLabelOpacity.domain([invertedValue, invertedValue + 0.8]);
    }

    if (changed.has('nodeFontSizeMultiplier')) {
      this.rs.nodeFontSizeMultiplier = this.nodeFontSizeMultiplier;
    }

    if (changed.has('augmentedGraph')) {
      if (!this.augmentedGraph) return;
      this.rs.augmented = this.augmentedGraph;
      this._updateGraphData();
      this._updateFocusSets();

      if (this.firstGraphLoad && this.graphInstance) {
        this.firstGraphLoad = false;
        this.graphInstance.zoom(this.graphInstance.zoom() * 1.5);
        this.graphInstance.cooldownTicks(100);
        this.graphInstance.onEngineStop(() => {
          this.graphInstance!.onEngineStop(() => {});
          this.graphInstance!.zoomToFit(500);
        });
      }
    }
  }

  selectNote(noteId: string) {
    if (!this.graphInstance) return;
    const nodes = this.graphInstance.graphData().nodes as any[];
    const node = nodes.find(n => n.id === noteId);
    if (node) {
      if (this.rs.selection.enableRefocus) {
        this.graphInstance.centerAt(node.x, node.y, 300);
      }
      if (this.rs.selection.enableZoom) {
        this.graphInstance.zoom(3, 300);
      }
      this._selectNode(noteId, false);
    }
  }

  private _updateFocusSets() {
    if (!this.rs.augmented) return;
    const { focusNodes, focusLinks } = computeFocusSets(
      this.rs.selectedNodes,
      this.rs.hoverNode,
      this.rs.selection.neighborDepth,
      this.rs.augmented.nodeInfo,
      this.rs.augmented.links
    );
    this.rs.focusNodes = focusNodes;
    this.rs.focusLinks = focusLinks;
  }

  private _selectNode(nodeId: string | null, isAppend: boolean) {
    if (!isAppend) this.rs.selectedNodes.clear();
    if (nodeId != null) this.rs.selectedNodes.add(nodeId);
    this._updateFocusSets();
  }

  private _updateGraphData() {
    if (!this.rs.augmented || !this.graphInstance) return;

    const nodeIdsToAdd = new Set(
      Object.values(this.rs.augmented.nodeInfo)
        .filter(n => this.rs.showNodesOfType[n.type])
        .map(n => n.id)
    );

    const nodeIdsToRemove = new Set<string>();
    for (const node of this.rs.data.nodes) {
      if (nodeIdsToAdd.has(node.id)) {
        nodeIdsToAdd.delete(node.id);
      } else {
        nodeIdsToRemove.add(node.id);
      }
    }

    for (const id of nodeIdsToRemove) {
      const idx = this.rs.data.nodes.findIndex(n => n.id === id);
      if (idx !== -1) this.rs.data.nodes.splice(idx, 1);
    }
    for (const id of nodeIdsToAdd) {
      this.rs.data.nodes.push({ id });
    }

    const nodeIdSet = new Set(this.rs.data.nodes.map(n => n.id));
    this.rs.data.links = this.rs.augmented.links
      .filter(link => {
        return (
          nodeIdSet.has(getLinkNodeId(link.source)) &&
          nodeIdSet.has(getLinkNodeId(link.target))
        );
      })
      .map(link => ({ ...link }));

    this.rs.hoverNode =
      this.rs.augmented.nodeInfo[this.rs.hoverNode ?? ''] != null
        ? this.rs.hoverNode
        : null;
    this.rs.selectedNodes = new Set(
      [...this.rs.selectedNodes].filter(
        id => this.rs.augmented!.nodeInfo[id] != null
      )
    );

    this.graphInstance.graphData(this.rs.data as any);
    (this.graphInstance.d3Force('link') as any)?.links(this.rs.data.links);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'foam-graph-canvas': GraphCanvas;
  }
}

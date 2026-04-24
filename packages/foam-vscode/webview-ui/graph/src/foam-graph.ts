import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getDefaultStyle } from './lib/defaults';
import { augmentGraphInfo } from './lib/graph-utils';
import { mergeStyles, resolveStyle } from './lib/style';
import type { GraphData, GraphStyle, GroupRule } from './protocol';
import type { AugmentedGraph, ResolvedStyle, Forces, Selection, LinkAnimation } from './lib/types';
import './components/graph-canvas';
import './components/control-panel';

@customElement('foam-graph')
export class FoamGraph extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }
  `;

  // Public API
  @property({ type: Object }) graphData: GraphData | null = null;
  @property({ type: Object }) graphStyle: GraphStyle | null = null;
  @property({ type: Boolean }) showControls = true;

  // Internal control state
  @state() private augmentedGraph: AugmentedGraph | null = null;
  @state() private selectedNodeId: string | null = null;
  @state() private showNodesOfType: Record<string, boolean> = {
    placeholder: true,
    image: false,
    attachment: false,
    note: true,
    tag: true,
  };
  @state() private textFade: number = 0;
  @state() private nodeFontSizeMultiplier: number = 1;
  @state() private nodeSizeMultiplier: number = 2;
  @state() private linkWidthMultiplier: number = 2;
  @state() private animateLinks: LinkAnimation = 'forward';
  @state() private forces: Forces = { collide: 1, repel: 10, link: 30, velocityDecay: 0.4 };
  @property({ type: Object }) selection: Selection = {
    neighborDepth: 1,
    centerOnSelect: true,
    zoomOnSelect: true,
    focusGraph: false,
    focusDepth: 1,
  };
  @state() private localStylePatch: GraphStyle = {};
  @state() private groups: GroupRule[] = [];

  private get resolvedStyle(): ResolvedStyle {
    const merged = mergeStyles(this.graphStyle, this.localStylePatch);
    return resolveStyle(merged, getDefaultStyle());
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('graphData') && this.graphData) {
      this.augmentedGraph = augmentGraphInfo(this.graphData);
    }
    if ((changed.has('graphData') || changed.has('graphStyle')) && this.augmentedGraph) {
      this._syncNodeTypes(this.augmentedGraph);
    }
    if (changed.has('graphStyle') && this.graphStyle?.groups) {
      this.groups = this.graphStyle.groups;
    }
    if (changed.has('graphStyle') && this.graphStyle?.showNodesOfType) {
      this.showNodesOfType = { ...this.showNodesOfType, ...this.graphStyle.showNodesOfType };
    }
  }

  private _syncNodeTypes(graph: AugmentedGraph) {
    const specialTypes = new Set(['tag', 'attachment', 'image', 'placeholder', 'note']);
    const types = new Set([
      ...Object.values(graph.nodeInfo).map(n => n.type),
      ...Object.keys(this.resolvedStyle.node).filter(t => !specialTypes.has(t)),
    ]);
    const updated = { ...this.showNodesOfType };
    let changed = false;

    for (const type of types) {
      if (updated[type] == null) {
        updated[type] = type !== 'image' && type !== 'attachment';
        changed = true;
      }
    }
    const keepTypes = new Set(['tag', 'attachment', 'image', 'placeholder']);
    for (const type of Object.keys(updated)) {
      if (!types.has(type) && !keepTypes.has(type)) {
        delete updated[type];
        changed = true;
      }
    }

    if (changed) this.showNodesOfType = updated;
  }

  private get _nodeTypeCounts(): Record<string, number> {
    if (!this.augmentedGraph) return {};
    const counts: Record<string, number> = {};
    for (const node of Object.values(this.augmentedGraph.nodeInfo)) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }
    return counts;
  }

  render() {
    const resolved = this.resolvedStyle;
    return html`
      <foam-graph-canvas
        .augmentedGraph=${this.augmentedGraph}
        .style=${resolved}
        .showNodesOfType=${this.showNodesOfType}
        .groups=${this.groups}
        .forces=${this.forces}
        .selection=${this.selection}
        .textFade=${this.textFade}
        .nodeFontSizeMultiplier=${this.nodeFontSizeMultiplier}
        .nodeSizeMultiplier=${this.nodeSizeMultiplier}
        .linkWidthMultiplier=${this.linkWidthMultiplier}
        .animateLinks=${this.animateLinks}
        .focusNodeId=${this.selection.focusGraph ? this.selectedNodeId : null}
        .focusDepth=${this.selection.focusDepth}
        @node-click=${(e: CustomEvent) => this._onNodeClick(e.detail)}
      ></foam-graph-canvas>
      ${this.showControls
        ? html`<foam-control-panel
            .style=${resolved}
            .showNodesOfType=${this.showNodesOfType}
            .nodeTypeCounts=${this._nodeTypeCounts}
            .augmentedGraph=${this.augmentedGraph}
            .groups=${this.groups}
            .textFade=${this.textFade}
            .nodeFontSizeMultiplier=${this.nodeFontSizeMultiplier}
            .nodeSizeMultiplier=${this.nodeSizeMultiplier}
            .linkWidthMultiplier=${this.linkWidthMultiplier}
            .animateLinks=${this.animateLinks}
            .forces=${this.forces}
            .selection=${this.selection}
            @style-change=${(e: CustomEvent) => this._onStyleChange(e.detail)}
            @show-nodes-of-type-change=${(e: CustomEvent) => (this.showNodesOfType = e.detail)}
            @groups-change=${(e: CustomEvent) => (this.groups = e.detail)}
            @text-fade-change=${(e: CustomEvent) => (this.textFade = e.detail)}
            @font-size-multiplier-change=${(e: CustomEvent) => (this.nodeFontSizeMultiplier = e.detail)}
            @node-size-multiplier-change=${(e: CustomEvent) => (this.nodeSizeMultiplier = e.detail)}
            @link-width-multiplier-change=${(e: CustomEvent) => (this.linkWidthMultiplier = e.detail)}
            @animate-links-change=${(e: CustomEvent) => (this.animateLinks = e.detail)}
            @forces-change=${(e: CustomEvent) => (this.forces = e.detail)}
            @selection-change=${(e: CustomEvent) => (this.selection = e.detail)}
          ></foam-control-panel>`
        : null}
    `;
  }

  selectNote(noteId: string) {
    const canvas = this.shadowRoot?.querySelector('foam-graph-canvas') as any;
    canvas?.selectNote(noteId);
  }

  private _onNodeClick(nodeId: string) {
    this.selectedNodeId = nodeId;
    this.dispatchEvent(new CustomEvent('node-click', { detail: nodeId, bubbles: true, composed: true }));
  }

  private _onStyleChange(patch: Partial<ResolvedStyle>) {
    const { colorMode, ...styleProps } = patch as any;
    this.localStylePatch = {
      ...this.localStylePatch,
      ...(colorMode !== undefined ? { colorMode } : {}),
      style: { ...this.localStylePatch?.style, ...styleProps },
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'foam-graph': FoamGraph;
  }
}

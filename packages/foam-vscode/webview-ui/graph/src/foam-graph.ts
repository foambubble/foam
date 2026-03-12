import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getDefaultStyle } from './lib/defaults';
import { augmentGraphInfo } from './lib/graph-utils';
import type { GraphData, StylePayload } from './protocol';
import type { AugmentedGraph, ResolvedStyle, Forces, Selection } from './lib/types';
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
  @property({ type: Object }) graphStyle: StylePayload | null = null;

  // Internal control state
  @state() private augmentedGraph: AugmentedGraph | null = null;
  @state() private showNodesOfType: Record<string, boolean> = {
    placeholder: true,
    image: false,
    attachment: false,
    note: true,
    tag: true,
  };
  @state() private textFade: number = 3.8;
  @state() private nodeFontSizeMultiplier: number = 1;
  @state() private forces: Forces = { collide: 2, repel: 30, link: 30, velocityDecay: 0.4 };
  @state() private selection: Selection = { neighborDepth: 1, enableRefocus: true, enableZoom: true };
  @state() private localStylePatch: StylePayload = {};

  private get resolvedStyle(): ResolvedStyle {
    return this._resolveStyle(this._mergedStylePayload);
  }

  private get _mergedStylePayload(): StylePayload {
    // graphStyle from the outside takes precedence; localStylePatch layers on top
    return {
      ...this.graphStyle,
      ...this.localStylePatch,
      style: { ...this.graphStyle?.style, ...this.localStylePatch?.style },
    };
  }

  private _resolveStyle(payload: StylePayload | null): ResolvedStyle {
    const defaults = getDefaultStyle();
    if (!payload) return defaults;
    return {
      ...defaults,
      ...payload.style,
      lineColor:
        payload.style?.lineColor ||
        payload.style?.node?.note ||
        defaults.lineColor,
      node: {
        ...defaults.node,
        ...payload.style?.node,
      },
      colorMode: payload.colorMode ?? defaults.colorMode,
    };
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('graphData') && this.graphData) {
      this.augmentedGraph = augmentGraphInfo(this.graphData);
      this._syncNodeTypes(this.augmentedGraph);
    }
  }

  private _syncNodeTypes(graph: AugmentedGraph) {
    const types = new Set(Object.values(graph.nodeInfo).map(n => n.type));
    const updated = { ...this.showNodesOfType };
    let changed = false;

    for (const type of types) {
      if (updated[type] == null) {
        updated[type] = type !== 'image' && type !== 'attachment';
        changed = true;
      }
    }
    for (const type of Object.keys(updated)) {
      if (!types.has(type)) {
        delete updated[type];
        changed = true;
      }
    }

    if (changed) this.showNodesOfType = updated;
  }

  render() {
    const resolved = this.resolvedStyle;
    return html`
      <foam-graph-canvas
        .augmentedGraph=${this.augmentedGraph}
        .style=${resolved}
        .showNodesOfType=${this.showNodesOfType}
        .forces=${this.forces}
        .selection=${this.selection}
        .textFade=${this.textFade}
        .nodeFontSizeMultiplier=${this.nodeFontSizeMultiplier}
        @node-click=${(e: CustomEvent) => this._onNodeClick(e.detail)}
      ></foam-graph-canvas>
      <foam-control-panel
        .style=${resolved}
        .showNodesOfType=${this.showNodesOfType}
        .textFade=${this.textFade}
        .nodeFontSizeMultiplier=${this.nodeFontSizeMultiplier}
        .forces=${this.forces}
        .selection=${this.selection}
        @style-change=${(e: CustomEvent) => this._onStyleChange(e.detail)}
        @show-nodes-of-type-change=${(e: CustomEvent) => (this.showNodesOfType = e.detail)}
        @text-fade-change=${(e: CustomEvent) => (this.textFade = e.detail)}
        @font-size-multiplier-change=${(e: CustomEvent) => (this.nodeFontSizeMultiplier = e.detail)}
        @forces-change=${(e: CustomEvent) => (this.forces = e.detail)}
        @selection-change=${(e: CustomEvent) => (this.selection = e.detail)}
      ></foam-control-panel>
    `;
  }

  selectNote(noteId: string) {
    const canvas = this.shadowRoot?.querySelector('foam-graph-canvas') as any;
    canvas?.selectNote(noteId);
  }

  private _onNodeClick(nodeId: string) {
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

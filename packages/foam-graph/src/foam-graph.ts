import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { getDefaultStyle } from './lib/defaults';
import { createGraphModel, computeGraphStates } from './lib/graph-utils';
import {
  computeAutocompleteOptions,
  computeGroupMatchCounts,
  computeNodeTypeCounts,
  computePreviewMatchCount,
  computeVisibleGraph,
  deriveNodeTypeFilters,
  type VisibleGraph,
} from './lib/graph-view-model';
import { mergeStyles, resolveStyle } from './lib/style';
import { hashString, hashToHSL } from './lib/colors';
import type { GraphData, GraphStyle, GroupMatch, GroupRule } from './protocol';
import type {
  GraphModel,
  ResolvedStyle,
  Forces,
  Labels,
  Selection,
  GraphScope,
  LinkAnimation,
  GraphStates,
} from './lib/types';
import type { GraphCanvas } from './components/graph-canvas';
import type { GroupDraft } from './components/control-panel';
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
  @property({ type: Boolean }) showControls = false;
  @property({ type: String }) focusNodeId: string | null = null;
  @property({ type: Object }) graphScope: GraphScope = 'full';
  @property({ type: Number }) maxFitZoom: number | null = null;
  @property({ type: Object }) labels: Labels = { fade: 0 };
  @property({ type: Object }) forces: Forces = {
    collide: 1,
    repel: 10,
    link: 30,
    velocityDecay: 0.4,
  };
  @property({ type: Number }) linkWidthMultiplier: number = 2;
  @property({ type: Object }) selection: Selection = {
    neighborDepth: 1,
    centerOnSelect: true,
    zoomOnSelect: true,
  };

  @query('foam-graph-canvas') private canvas!: GraphCanvas;

  // Internal app state
  @state() private graphModel: GraphModel | null = null;
  @state() private selectedNodeIds = new Set<string>();
  @state() private hoverNodeId: string | null = null;
  @state() private showNodesOfType: Record<string, boolean> = {
    placeholder: true,
    image: false,
    attachment: false,
    note: true,
    tag: true,
  };
  @state() private nodeFontSizeMultiplier: number = 1;
  @state() private nodeSizeMultiplier: number = 2;
  @state() private animateLinks: LinkAnimation = 'forward';
  @state() private localStylePatch: GraphStyle = {};
  @state() private groups: GroupRule[] = [];
  @state() private groupDraft: GroupDraft = {
    active: false,
    property: 'type',
    value: '',
  };
  // Pipeline: GraphData -> GraphModel -> VisibleGraph plus GraphStates for rendering.
  @state() private visibleGraph: VisibleGraph | null = null;
  @state() private graphStates: GraphStates | null = null;

  private get resolvedStyle(): ResolvedStyle {
    const merged = mergeStyles(this.graphStyle, this.localStylePatch);
    return resolveStyle(merged, getDefaultStyle());
  }

  private get visibleFocusNodeId(): string | null {
    if (this.focusNodeId) return this.focusNodeId;
    if (this.graphScope === 'full') return null;
    return [...this.selectedNodeIds][0] ?? null;
  }

  updated(changed: Map<string, unknown>) {
    let shouldRecomputeVisibleGraph = false;
    let shouldRecomputeGraphStates = false;

    if (changed.has('graphData')) {
      this.graphModel = this.graphData
        ? createGraphModel(this.graphData)
        : null;
      this._pruneInteractionState();
      shouldRecomputeVisibleGraph = true;
      shouldRecomputeGraphStates = true;
    }

    if (changed.has('graphStyle') && this.graphStyle?.groups) {
      this.groups = this.graphStyle.groups;
      shouldRecomputeVisibleGraph = true;
    }

    if (changed.has('graphStyle') && this.graphStyle?.showNodesOfType) {
      this.showNodesOfType = {
        ...this.showNodesOfType,
        ...this.graphStyle.showNodesOfType,
      };
      shouldRecomputeVisibleGraph = true;
    }

    if (
      (changed.has('graphData') || changed.has('graphStyle')) &&
      this.graphModel
    ) {
      this.showNodesOfType = deriveNodeTypeFilters(
        this.graphModel,
        this.resolvedStyle,
        this.showNodesOfType
      );
      shouldRecomputeVisibleGraph = true;
    }

    if (changed.has('focusNodeId') || changed.has('graphScope')) {
      shouldRecomputeVisibleGraph = true;
    }

    if (changed.has('selection') || changed.has('hoverNodeId')) {
      shouldRecomputeGraphStates = true;
    }

    if (shouldRecomputeVisibleGraph) {
      this._recomputeVisibleGraph();
    }
    if (shouldRecomputeGraphStates) {
      this._recomputeGraphStates();
    }
  }

  render() {
    const resolved = this.resolvedStyle;
    const groupMatchCounts = this.graphModel
      ? computeGroupMatchCounts(this.graphModel, this.groups)
      : {};
    const autocompleteOptions = this.graphModel
      ? computeAutocompleteOptions(this.graphModel, this.groupDraft.property)
      : [];
    const previewMatchCount = this.graphModel
      ? computePreviewMatchCount(
          this.graphModel,
          this.groupDraft.property,
          this.groupDraft.value
        )
      : 0;

    return html`
      <foam-graph-canvas
        .visibleGraph=${this.visibleGraph}
        .graphStates=${this.graphStates}
        .style=${resolved}
        .groups=${this.groups}
        .forces=${this.forces}
        .labels=${this.labels}
        .nodeFontSizeMultiplier=${this.nodeFontSizeMultiplier}
        .nodeSizeMultiplier=${this.nodeSizeMultiplier}
        .linkWidthMultiplier=${this.linkWidthMultiplier}
        .animateLinks=${this.animateLinks}
        .maxFitZoom=${this.maxFitZoom}
        @canvas-node-click=${(e: CustomEvent) =>
          this._onCanvasNodeClick(e.detail)}
        @canvas-node-hover=${(e: CustomEvent) =>
          (this.hoverNodeId = e.detail)}
        @canvas-background-click=${(e: CustomEvent) =>
          this._onCanvasBackgroundClick(e.detail)}
      ></foam-graph-canvas>
      ${this.showControls
        ? html`<foam-control-panel
            .style=${resolved}
            .showNodesOfType=${this.showNodesOfType}
            .nodeTypeCounts=${computeNodeTypeCounts(this.graphModel)}
            .groupMatchCounts=${groupMatchCounts}
            .autocompleteOptions=${autocompleteOptions}
            .previewMatchCount=${previewMatchCount}
            .groupDraft=${this.groupDraft}
            .groups=${this.groups}
            .textFade=${typeof this.labels === 'object' ? this.labels.fade : 0}
            .nodeFontSizeMultiplier=${this.nodeFontSizeMultiplier}
            .nodeSizeMultiplier=${this.nodeSizeMultiplier}
            .linkWidthMultiplier=${this.linkWidthMultiplier}
            .animateLinks=${this.animateLinks}
            .forces=${this.forces}
            .selection=${this.selection}
            .graphScope=${this.graphScope}
            @graph-scope-change=${(e: CustomEvent) =>
              (this.graphScope = e.detail)}
            @style-change=${(e: CustomEvent) => this._onStyleChange(e.detail)}
            @toggle-node-type=${(e: CustomEvent) =>
              this._onToggleNodeType(e.detail)}
            @update-group=${(e: CustomEvent) => this._onUpdateGroup(e.detail)}
            @delete-group=${(e: CustomEvent) => this._onDeleteGroup(e.detail)}
            @start-draft=${() =>
              (this.groupDraft = {
                active: true,
                property: this.groupDraft.property,
                value: '',
              })}
            @cancel-draft=${() =>
              (this.groupDraft = { ...this.groupDraft, active: false })}
            @draft-change=${(e: CustomEvent) => (this.groupDraft = e.detail)}
            @add-group=${() => this._onAddGroup()}
            @text-fade-change=${(e: CustomEvent) => (this.labels = { fade: e.detail })}
            @font-size-multiplier-change=${(e: CustomEvent) =>
              (this.nodeFontSizeMultiplier = e.detail)}
            @node-size-multiplier-change=${(e: CustomEvent) =>
              (this.nodeSizeMultiplier = e.detail)}
            @link-width-multiplier-change=${(e: CustomEvent) =>
              (this.linkWidthMultiplier = e.detail)}
            @animate-links-change=${(e: CustomEvent) =>
              (this.animateLinks = e.detail)}
            @forces-change=${(e: CustomEvent) => (this.forces = e.detail)}
            @selection-change=${(e: CustomEvent) =>
              (this.selection = e.detail)}
          ></foam-control-panel>`
        : null}
    `;
  }

  selectNote(noteId: string) {
    this._selectNode(noteId, false);
    if (!this.visibleGraph?.nodeInfo[noteId]) return;
    if (this.selection.centerOnSelect) {
      this.canvas?.centerOnNode(
        noteId,
        this.selection.zoomOnSelect ? 3 : undefined,
        300
      );
    } else if (this.selection.zoomOnSelect) {
      this.canvas?.zoom(3, 300);
    }
  }

  private _onCanvasNodeClick(detail: { nodeId: string; append: boolean }) {
    this._selectNode(detail.nodeId, detail.append);
    this.dispatchEvent(
      new CustomEvent('node-click', {
        detail: detail.nodeId,
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onCanvasBackgroundClick(detail: { append: boolean }) {
    if (!detail.append) {
      this.selectedNodeIds = new Set();
      this._recomputeGraphStates();
      this._recomputeVisibleGraphIfSelectionAffectsScope();
    }
  }

  private _selectNode(nodeId: string, append: boolean) {
    const next = append ? new Set(this.selectedNodeIds) : new Set<string>();
    next.add(nodeId);
    this.selectedNodeIds = next;
    this._recomputeGraphStates();
    this._recomputeVisibleGraphIfSelectionAffectsScope();
  }

  private _onToggleNodeType(detail: { type: string; visible: boolean }) {
    this.showNodesOfType = {
      ...this.showNodesOfType,
      [detail.type]: detail.visible,
    };
    this._recomputeVisibleGraph();
  }

  private _onUpdateGroup(detail: { index: number; patch: Partial<GroupRule> }) {
    this.groups = this.groups.map((group, index) =>
      index === detail.index ? { ...group, ...detail.patch } : group
    );
    this._recomputeVisibleGraph();
  }

  private _onDeleteGroup(index: number) {
    this.groups = this.groups.filter((_, i) => i !== index);
    this._recomputeVisibleGraph();
  }

  private _onAddGroup() {
    if (!this.groupDraft.value) return;
    const label = `${this.groupDraft.property}=${this.groupDraft.value}`;
    this.groups = [
      ...this.groups,
      {
        id: `group-${Date.now()}`,
        label,
        color: hashToHSL(hashString(label)),
        enabled: true,
        match: {
          property: this.groupDraft.property,
          value: this.groupDraft.value,
        },
      },
    ];
    this.groupDraft = { ...this.groupDraft, active: false, value: '' };
    this._recomputeVisibleGraph();
  }

  private _onStyleChange(patch: Partial<ResolvedStyle>) {
    const { colorMode, ...styleProps } = patch as any;
    this.localStylePatch = {
      ...this.localStylePatch,
      ...(colorMode !== undefined ? { colorMode } : {}),
      style: { ...this.localStylePatch?.style, ...styleProps },
    };
  }

  private _pruneInteractionState() {
    if (!this.graphModel) {
      this.selectedNodeIds = new Set();
      this.hoverNodeId = null;
      return;
    }
    this.selectedNodeIds = new Set(
      [...this.selectedNodeIds].filter(
        id => this.graphModel!.nodeInfo[id] != null
      )
    );
    if (this.hoverNodeId && !this.graphModel.nodeInfo[this.hoverNodeId]) {
      this.hoverNodeId = null;
    }
  }

  private _recomputeVisibleGraph() {
    this.visibleGraph = this.graphModel
      ? computeVisibleGraph(
          this.graphModel,
          this.showNodesOfType,
          this.groups,
          this.visibleFocusNodeId,
          this.graphScope
        )
      : null;
  }

  private _recomputeGraphStates() {
    this.graphStates = this.graphModel
      ? computeGraphStates(
          this.graphModel,
          this.selectedNodeIds,
          this.hoverNodeId,
          this.selection.neighborDepth
        )
      : null;
  }

  private _recomputeVisibleGraphIfSelectionAffectsScope() {
    if (!this.focusNodeId && this.graphScope !== 'full') {
      this._recomputeVisibleGraph();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'foam-graph': FoamGraph;
  }
}

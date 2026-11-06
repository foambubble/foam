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
import { DEFAULT_LABEL_MAX_LENGTH } from './lib/labels';
import type {
  GraphData,
  GraphStyle,
  GraphViewState,
  GroupMatch,
  GroupRule,
} from './protocol';
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

/**
 * Built-in defaults for the interactive display state — the base layer a
 * view restore starts from, under the declared style and the saved state.
 */
const defaultViewState = () => ({
  showNodesOfType: {
    placeholder: true,
    image: false,
    attachment: false,
    note: true,
    tag: true,
  } as Record<string, boolean>,
  groups: [] as GroupRule[],
  localStylePatch: {} as GraphStyle,
  labels: { fade: 0 } as Labels,
  forces: {
    collide: 1,
    repel: 10,
    link: 30,
    velocityDecay: 0.4,
  } as Forces,
  selection: {
    neighborDepth: 1,
    centerOnSelect: true,
    zoomOnSelect: true,
  } as Selection,
  graphScope: 'full' as GraphScope,
  nodeFontSizeMultiplier: 1,
  nodeSizeMultiplier: 2,
  linkWidthMultiplier: 2,
  animateLinks: 'forward' as LinkAnimation,
  labelMaxLength: DEFAULT_LABEL_MAX_LENGTH,
});

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
  @property({ type: Object }) graphScope: GraphScope =
    defaultViewState().graphScope;
  @property({ type: Number }) maxFitZoom: number | null = null;
  @property({ type: Object }) labels: Labels = defaultViewState().labels;
  @property({ type: Object }) forces: Forces = defaultViewState().forces;
  @property({ type: Number }) linkWidthMultiplier: number =
    defaultViewState().linkWidthMultiplier;
  @property({ type: Object }) selection: Selection =
    defaultViewState().selection;

  @query('foam-graph-canvas') private canvas!: GraphCanvas;

  // Internal app state
  @state() private graphModel: GraphModel | null = null;
  @state() private selectedNodeIds = new Set<string>();
  @state() private hoverNodeId: string | null = null;
  @state() private showNodesOfType: Record<string, boolean> =
    defaultViewState().showNodesOfType;
  @state() private nodeFontSizeMultiplier: number =
    defaultViewState().nodeFontSizeMultiplier;
  @state() private nodeSizeMultiplier: number =
    defaultViewState().nodeSizeMultiplier;
  @state() private labelMaxLength: number = defaultViewState().labelMaxLength;
  @state() private animateLinks: LinkAnimation =
    defaultViewState().animateLinks;
  @state() private localStylePatch: GraphStyle =
    defaultViewState().localStylePatch;
  @state() private groups: GroupRule[] = defaultViewState().groups;
  /**
   * The user's layer of the display state: the last restored state, then
   * the full snapshot after each user change (what the host persists).
   * Null until a host first restores a view state.
   */
  private userLayer: GraphViewState | null = null;
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

    // Once a view state has been applied, a re-sent style (inline
    // show-graph config, a foam.graph.style edit, re-invoking the open
    // view) is re-layered under the user's state rather than written over
    // it: defaults → new style → user layer. An untouched view follows the
    // style; one the user adjusted keeps their choices, which the next save
    // would otherwise persist as a reset.
    if (changed.has('graphStyle') && this.userLayer) {
      this.applyViewState(this.userLayer);
    }

    if (
      changed.has('graphStyle') &&
      !this.userLayer &&
      this.graphStyle?.groups
    ) {
      this.groups = this.graphStyle.groups;
      shouldRecomputeVisibleGraph = true;
    }

    if (
      changed.has('graphStyle') &&
      !this.userLayer &&
      this.graphStyle?.showNodesOfType
    ) {
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
        .labelMaxLength=${this.labelMaxLength}
        .animateLinks=${this.animateLinks}
        .maxFitZoom=${this.maxFitZoom}
        @canvas-node-click=${(e: CustomEvent) =>
          this._onCanvasNodeClick(e.detail)}
        @canvas-node-hover=${(e: CustomEvent) => (this.hoverNodeId = e.detail)}
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
            .labelMaxLength=${this.labelMaxLength}
            .animateLinks=${this.animateLinks}
            .forces=${this.forces}
            .selection=${this.selection}
            .graphScope=${this.graphScope}
            @graph-scope-change=${(e: CustomEvent) => {
              this.graphScope = e.detail;
              this._emitViewStateChange();
            }}
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
            @text-fade-change=${(e: CustomEvent) => {
              this.labels = { fade: e.detail };
              this._emitViewStateChange();
            }}
            @font-size-multiplier-change=${(e: CustomEvent) => {
              this.nodeFontSizeMultiplier = e.detail;
              this._emitViewStateChange();
            }}
            @node-size-multiplier-change=${(e: CustomEvent) => {
              this.nodeSizeMultiplier = e.detail;
              this._emitViewStateChange();
            }}
            @link-width-multiplier-change=${(e: CustomEvent) => {
              this.linkWidthMultiplier = e.detail;
              this._emitViewStateChange();
            }}
            @label-max-length-change=${(e: CustomEvent) =>
              this._onLabelMaxLengthChange(e.detail)}
            @animate-links-change=${(e: CustomEvent) => {
              this.animateLinks = e.detail;
              this._emitViewStateChange();
            }}
            @forces-change=${(e: CustomEvent) => {
              this.forces = e.detail;
              this._emitViewStateChange();
            }}
            @selection-change=${(e: CustomEvent) => {
              this.selection = e.detail;
              this._emitViewStateChange();
            }}
          ></foam-control-panel>`
        : null}
    `;
  }

  /** Snapshot of the interactive display state, for persistence. */
  getViewState(): GraphViewState {
    return {
      showNodesOfType: { ...this.showNodesOfType },
      groups: this.groups,
      localStylePatch: this.localStylePatch,
      labels: this.labels,
      forces: this.forces,
      selection: this.selection,
      graphScope: this.graphScope,
      nodeFontSizeMultiplier: this.nodeFontSizeMultiplier,
      nodeSizeMultiplier: this.nodeSizeMultiplier,
      linkWidthMultiplier: this.linkWidthMultiplier,
      animateLinks: this.animateLinks,
      labelMaxLength: this.labelMaxLength,
    };
  }

  /**
   * Applies a persisted display state with replace semantics: the state is
   * layered over built-in defaults and the declared style, never over the
   * live interactive state — otherwise a previously shown view's tweaks
   * would leak into the one being restored.
   */
  applyViewState(state: GraphViewState) {
    this.userLayer = state;
    const defaults = defaultViewState();
    this.showNodesOfType = defaults.showNodesOfType;
    this.groups = defaults.groups;
    this.localStylePatch = defaults.localStylePatch;
    this.labels = defaults.labels;
    this.forces = defaults.forces;
    this.selection = defaults.selection;
    this.graphScope = defaults.graphScope;
    this.nodeFontSizeMultiplier = defaults.nodeFontSizeMultiplier;
    this.nodeSizeMultiplier = defaults.nodeSizeMultiplier;
    this.linkWidthMultiplier = defaults.linkWidthMultiplier;
    this.animateLinks = defaults.animateLinks;
    this.labelMaxLength = defaults.labelMaxLength;

    // the declared style (base settings + view config) sits between the
    // defaults and the saved state, as on a cold load
    if (this.graphStyle?.groups) this.groups = this.graphStyle.groups;
    if (this.graphStyle?.showNodesOfType) {
      this.showNodesOfType = {
        ...this.showNodesOfType,
        ...this.graphStyle.showNodesOfType,
      };
    }

    if (state.showNodesOfType) {
      this.showNodesOfType = {
        ...this.showNodesOfType,
        ...state.showNodesOfType,
      };
    }
    if (state.groups) this.groups = state.groups;
    if (state.localStylePatch) this.localStylePatch = state.localStylePatch;
    if (state.labels !== undefined) this.labels = state.labels;
    if (state.forces) this.forces = state.forces;
    if (state.selection) this.selection = state.selection;
    if (state.graphScope !== undefined) this.graphScope = state.graphScope;
    if (state.nodeFontSizeMultiplier !== undefined) {
      this.nodeFontSizeMultiplier = state.nodeFontSizeMultiplier;
    }
    if (state.nodeSizeMultiplier !== undefined) {
      this.nodeSizeMultiplier = state.nodeSizeMultiplier;
    }
    if (state.linkWidthMultiplier !== undefined) {
      this.linkWidthMultiplier = state.linkWidthMultiplier;
    }
    if (state.animateLinks !== undefined) {
      this.animateLinks = state.animateLinks;
    }
    if (state.labelMaxLength !== undefined) {
      this.labelMaxLength = state.labelMaxLength;
    }

    if (this.graphModel) {
      this.showNodesOfType = deriveNodeTypeFilters(
        this.graphModel,
        this.resolvedStyle,
        this.showNodesOfType
      );
    }
    this._recomputeVisibleGraph();
    this._recomputeGraphStates();
  }

  /**
   * Announces that the user changed a display option. Carries no payload:
   * the host pulls `getViewState()` when it is ready to persist (e.g.
   * after a debounce), so one snapshot is built per save, not per tick.
   */
  private _emitViewStateChange() {
    this.userLayer = this.getViewState();
    this.dispatchEvent(
      new CustomEvent('view-state-change', { bubbles: true, composed: true })
    );
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

  private _onLabelMaxLengthChange(value: number) {
    this.labelMaxLength = value;
    this._emitViewStateChange();
  }

  private _onToggleNodeType(detail: { type: string; visible: boolean }) {
    this.showNodesOfType = {
      ...this.showNodesOfType,
      [detail.type]: detail.visible,
    };
    this._recomputeVisibleGraph();
    this._emitViewStateChange();
  }

  private _onUpdateGroup(detail: { index: number; patch: Partial<GroupRule> }) {
    this.groups = this.groups.map((group, index) =>
      index === detail.index ? { ...group, ...detail.patch } : group
    );
    this._recomputeVisibleGraph();
    this._emitViewStateChange();
  }

  private _onDeleteGroup(index: number) {
    this.groups = this.groups.filter((_, i) => i !== index);
    this._recomputeVisibleGraph();
    this._emitViewStateChange();
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
    this._emitViewStateChange();
  }

  private _onStyleChange(patch: Partial<ResolvedStyle>) {
    const { colorMode, ...styleProps } = patch as any;
    this.localStylePatch = {
      ...this.localStylePatch,
      ...(colorMode !== undefined ? { colorMode } : {}),
      style: { ...this.localStylePatch?.style, ...styleProps },
    };
    this._emitViewStateChange();
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

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
import {
  defaultViewState,
  isSameViewSetting,
  layerViewState,
} from './lib/view-state';
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

@customElement('foam-graph')
export class FoamGraph extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }

    /*
     * All that is left over the graph while the controls are hidden, so it
     * takes the corner the panel had and nothing more.
     */
    .show-controls {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: var(--vscode-sideBar-background, #252526);
      border: 1px solid var(--vscode-panel-border, #454545);
      border-radius: 4px;
      color: var(--vscode-foreground, #ccc);
      cursor: pointer;
      opacity: 0.75;
      z-index: 10;
      transition: opacity 150ms ease-out;
    }

    @starting-style {
      .show-controls {
        opacity: 0;
      }
    }

    .show-controls:hover,
    .show-controls:focus-visible {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .show-controls {
        transition: none;
      }
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
  /** The smallest area, in screen px across, that taps or clicks a node. */
  @property({ type: Number }) minTapSize: number | null = null;
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
   * Whether the user keeps the panel on screen, where the host offers
   * controls. Hiding it sets `hidden` on the panel rather than taking it out
   * of the render, so the state only its DOM holds — which of its sections
   * are open — is still there when it comes back.
   */
  @state() private showControlPanel: boolean =
    defaultViewState().showControlPanel;
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

  /**
   * Whether the view shows anything other than what Reset view brings back:
   * the same layering from an empty saved state, with type filters filled in
   * for the graph's types as on load. Styles are compared resolved, so a
   * local patch that repeats the declared style is no change.
   */
  private get viewChanged(): boolean {
    const configured = layerViewState(this.graphStyle, {});
    const configuredStyle = resolveStyle(
      mergeStyles(this.graphStyle, configured.localStylePatch),
      getDefaultStyle()
    );
    if (this.graphModel) {
      configured.showNodesOfType = deriveNodeTypeFilters(
        this.graphModel,
        configuredStyle,
        configured.showNodesOfType
      );
    }
    return (
      !isSameViewSetting(
        { ...this.getViewState(), localStylePatch: undefined },
        { ...configured, localStylePatch: undefined }
      ) || !isSameViewSetting(this.resolvedStyle, configuredStyle)
    );
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
        .minTapSize=${this.minTapSize}
        @canvas-node-click=${(e: CustomEvent) =>
          this._onCanvasNodeClick(e.detail)}
        @canvas-node-hover=${(e: CustomEvent) => (this.hoverNodeId = e.detail)}
        @canvas-background-click=${(e: CustomEvent) =>
          this._onCanvasBackgroundClick(e.detail)}
      ></foam-graph-canvas>
      ${this.showControls
        ? html`<foam-control-panel
            ?hidden=${!this.showControlPanel}
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
            .viewChanged=${this.viewChanged}
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
            @reset-view=${() => this._onResetView()}
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
            @hide-controls=${() => this._setControlPanelVisible(false)}
          ></foam-control-panel>`
        : null}
      ${this.showControls && !this.showControlPanel
        ? html`<button
            class="show-controls"
            title="Show the controls panel"
            aria-label="Show the controls panel"
            @click=${() => this._setControlPanelVisible(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M2 4.5 H14 M2 11.5 H14" />
              <path d="M6 2.5 V6.5 M10.5 9.5 V13.5" />
            </svg>
          </button>`
        : null}
    `;
  }

  /** Snapshot of the interactive display state, for persistence. */
  getViewState(): GraphViewState {
    return {
      showControlPanel: this.showControlPanel,
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
    const layered = layerViewState(this.graphStyle, state);
    this.showControlPanel = layered.showControlPanel;
    this.showNodesOfType = layered.showNodesOfType;
    this.groups = layered.groups;
    this.localStylePatch = layered.localStylePatch;
    this.labels = layered.labels;
    this.forces = layered.forces;
    this.selection = layered.selection;
    this.graphScope = layered.graphScope;
    this.nodeFontSizeMultiplier = layered.nodeFontSizeMultiplier;
    this.nodeSizeMultiplier = layered.nodeSizeMultiplier;
    this.linkWidthMultiplier = layered.linkWidthMultiplier;
    this.animateLinks = layered.animateLinks;
    this.labelMaxLength = layered.labelMaxLength;

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

  /**
   * Fits the graph into view once its layout has settled, or at once if it
   * has. The view fits only its first graph by itself: call this after
   * setting `graphData` to fit a later one.
   */
  async zoomToFit() {
    // a new graph reaches the canvas one update after it reaches this element
    let done = await this.updateComplete;
    while (!done) done = await this.updateComplete;
    await this.canvas?.updateComplete;
    this.canvas?.fitWhenSettled();
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

  /**
   * Back to the view's configured settings: defaults → declared style, with
   * an empty user layer, so later style changes apply again. Announced as a
   * reset rather than a change: saving this state would freeze the declared
   * config into the view's saved state.
   */
  private _onResetView() {
    this.applyViewState({});
    this.dispatchEvent(
      new CustomEvent('view-state-reset', { bubbles: true, composed: true })
    );
  }

  private _setControlPanelVisible(visible: boolean) {
    this.showControlPanel = visible;
    this._emitViewStateChange();
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

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './autocomplete-input';
import { getTypeColor, hashString, hashToHSL } from '../lib/colors';
import { matchesGroup } from '../lib/groups';
import type {
  ResolvedStyle,
  Forces,
  Selection,
  GraphScope,
  AugmentedGraph,
} from '../lib/types';
import type { GroupRule, GroupMatch } from '../protocol';

@customElement('foam-control-panel')
export class ControlPanel extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      top: 8px;
      right: 8px;
      width: 220px;
      display: block;
      background: var(--vscode-sideBar-background, #252526);
      border: 1px solid var(--vscode-panel-border, #454545);
      border-radius: 4px;
      font-size: 12px;
      color: var(--vscode-foreground, #ccc);
      z-index: 10;
      user-select: none;
    }

    details {
      border-bottom: 1px solid var(--vscode-panel-border, #454545);
    }

    details:last-child {
      border-bottom: none;
    }

    summary {
      padding: 5px 8px;
      cursor: pointer;
      font-weight: 600;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--vscode-sideBarSectionHeader-background, #2d2d2d);
    }

    summary::before {
      content: '▶';
      font-size: 8px;
      transition: transform 0.1s;
    }

    details[open] summary::before {
      transform: rotate(90deg);
    }

    .section-content {
      padding: 6px 8px 8px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    .checkbox-row .group-dot {
      margin-left: auto;
    }

    .checkbox-row input[type='checkbox'] {
      appearance: none;
      -webkit-appearance: none;
      width: 13px;
      height: 13px;
      flex-shrink: 0;
      border: 1px solid var(--vscode-checkbox-border, #6b6b6b);
      background: var(--vscode-checkbox-background, #3c3c3c);
      border-radius: 2px;
      margin: 0;
      cursor: pointer;
      position: relative;
    }

    .checkbox-row input[type='checkbox']:checked {
      background: var(--vscode-focusBorder, #007acc);
      border-color: var(--vscode-focusBorder, #007acc);
    }

    .checkbox-row input[type='checkbox']:checked::after {
      content: '';
      position: absolute;
      left: 3px;
      top: 0px;
      width: 4px;
      height: 8px;
      border: 1.5px solid white;
      border-top: none;
      border-left: none;
      transform: rotate(45deg);
    }

    .slider-row {
      display: grid;
      grid-template-columns: 60px 1fr 32px;
      align-items: center;
      gap: 4px;
    }

    .slider-row input[type='range'] {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      height: 3px;
      background: var(--vscode-scrollbarSlider-background, #424242);
      border-radius: 2px;
      outline: none;
      margin: 0;
      cursor: pointer;
    }

    .slider-row input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 11px;
      height: 11px;
      background: var(--vscode-focusBorder, #007acc);
      border-radius: 50%;
      cursor: pointer;
    }

    .slider-row input[type='range']::-moz-range-thumb {
      width: 11px;
      height: 11px;
      background: var(--vscode-focusBorder, #007acc);
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    .value {
      text-align: right;
      font-variant-numeric: tabular-nums;
      opacity: 0.8;
    }

    .select-row {
      display: grid;
      grid-template-columns: 60px 1fr;
      align-items: center;
      gap: 4px;
    }

    .group-dot {
      font-size: 10px;
      line-height: 1;
      flex-shrink: 0;
    }

    select {
      background: var(--vscode-dropdown-background, #3c3c3c);
      color: var(--vscode-dropdown-foreground, #ccc);
      border: 1px solid var(--vscode-dropdown-border, #454545);
      padding: 2px 4px;
      font-size: 12px;
    }

    .group-divider {
      border: none;
      border-top: 1px solid var(--vscode-panel-border, #454545);
      margin: 4px 0;
    }

    .group-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .group-dot {
      cursor: pointer;
    }

    .group-dot input[type='color'] {
      display: none;
    }

    .group-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .group-match-hint {
      opacity: 0.55;
      font-size: 10px;
      flex-shrink: 0;
    }

    .icon-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground, #ccc);
      cursor: pointer;
      padding: 0 2px;
      font-size: 11px;
      opacity: 0.6;
      flex-shrink: 0;
    }

    .icon-btn:hover {
      opacity: 1;
    }

    .add-group-btn {
      background: none;
      border: 1px dashed var(--vscode-panel-border, #454545);
      color: var(--vscode-foreground, #ccc);
      cursor: pointer;
      padding: 3px 6px;
      font-size: 11px;
      width: 100%;
      text-align: left;
      opacity: 0.7;
    }

    .add-group-btn:hover {
      opacity: 1;
    }

    .add-group-form {
      display: flex;
      flex-direction: column;
      gap: 5px;
      border: 1px solid var(--vscode-panel-border, #454545);
      padding: 6px;
    }

    .add-group-form input[type='text'] {
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #454545);
      padding: 2px 4px;
      font-size: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .add-group-form-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .add-group-form-row select {
      flex: 0 0 auto;
      width: 60px;
    }

    foam-autocomplete-input {
      flex: 1;
    }

    .add-group-form-actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
      align-items: center;
    }

    .btn {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ccc);
    }

    .color-swatch {
      width: 18px;
      height: 18px;
      border: 1px solid var(--vscode-panel-border, #454545);
      cursor: pointer;
      flex-shrink: 0;
      position: relative;
    }

    .color-swatch input[type='color'] {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      cursor: pointer;
      padding: 0;
      border: none;
    }
  `;

  @property({ type: Object }) style: ResolvedStyle = {} as ResolvedStyle;
  @property({ type: Object }) showNodesOfType: Record<string, boolean> = {};
  @property({ type: Object }) nodeTypeCounts: Record<string, number> = {};
  @property({ type: Array }) groups: GroupRule[] = [];
  @property({ type: Object }) augmentedGraph: AugmentedGraph | null = null;

  @state() private _addingGroup = false;
  @state() private _newGroupProperty: GroupMatch['property'] = 'type';
  @state() private _newGroupValue = '';
  @property({ type: Number }) textFade: number = 0;
  @property({ type: Number }) nodeFontSizeMultiplier: number = 1;
  @property({ type: Number }) nodeSizeMultiplier: number = 1.5;
  @property({ type: Number }) linkWidthMultiplier: number = 2;
  @property({ type: String }) animateLinks: 'forward' | 'off' | 'reverse' =
    'forward';
  @property({ type: Object }) forces: Forces = {
    collide: 2,
    repel: 30,
    link: 30,
    velocityDecay: 0.4,
  };
  @property({ type: Object }) selection: Selection = {
    neighborDepth: 1,
    centerOnSelect: true,
    zoomOnSelect: true,
  };
  @property({ type: Object }) graphScope: GraphScope = 'full';

  private static readonly _SPECIAL_TYPES = [
    'tag',
    'attachment',
    'image',
    'placeholder',
  ];
  private static readonly _SPECIAL_LABELS: Record<string, string> = {
    tag: 'Show tags',
    attachment: 'Show attachments',
    image: 'Show images',
    placeholder: 'Show placeholders',
  };

  private static readonly _MATCH_HINT: Record<string, string> = {
    type: 'exact or /regex/',
    path: 'substring or /regex/',
    tag: 'exact or /regex/',
    title: 'substring or /regex/',
  };

  private _groupMatchCount(group: GroupRule): number {
    if (!this.augmentedGraph) return 0;
    return Object.values(this.augmentedGraph.nodeInfo).filter(n =>
      matchesGroup(n, group)
    ).length;
  }

  private get _autocompleteOptions(): string[] {
    if (!this.augmentedGraph) return [];
    const nodes = Object.values(this.augmentedGraph.nodeInfo);
    if (this._newGroupProperty === 'type') {
      return [...new Set(nodes.map(n => n.type))]
        .filter(t => !ControlPanel._SPECIAL_TYPES.includes(t))
        .sort();
    }
    if (this._newGroupProperty === 'tag') {
      return [
        ...new Set(nodes.flatMap(n => (n.tags ?? []).map(t => t.label))),
      ].sort();
    }
    return [];
  }

  private get _previewMatchCount(): number {
    if (!this.augmentedGraph || !this._newGroupValue) return 0;
    const rule: GroupRule = {
      id: '',
      label: '',
      color: '',
      enabled: true,
      match: { property: this._newGroupProperty, value: this._newGroupValue },
    };
    return Object.values(this.augmentedGraph.nodeInfo).filter(n =>
      matchesGroup(n, rule)
    ).length;
  }

  private get _specialTypes() {
    return ControlPanel._SPECIAL_TYPES.filter(t => t in this.showNodesOfType);
  }

  private get _noteTypes() {
    return Object.keys(this.showNodesOfType)
      .filter(t => !ControlPanel._SPECIAL_TYPES.includes(t))
      .sort();
  }

  render() {
    return html`
      <details open>
        <summary>Groups</summary>
        <div class="section-content">
          <label class="select-row">
            <span>Color by</span>
            <select
              .value=${this.style.colorMode ?? 'none'}
              @change=${(e: Event) =>
                this._emit('style-change', {
                  colorMode: (e.target as HTMLSelectElement).value as
                    | 'none'
                    | 'directory'
                    | 'type',
                })}
            >
              <option value="none">None</option>
              <option value="directory">Directory</option>
              <option value="type">Type</option>
            </select>
          </label>

          ${this._specialTypes.map(
            type => html`
              <div class="checkbox-row">
                <input
                  type="checkbox"
                  .checked=${this.showNodesOfType[type]}
                  @change=${(e: Event) =>
                    this._emitShowNodesOfTypeChange(
                      type,
                      (e.target as HTMLInputElement).checked
                    )}
                />
                <span style="flex:1"
                  >${ControlPanel._SPECIAL_LABELS[type]}
                  (${this.nodeTypeCounts[type] ?? 0})</span
                >
                ${this.style.colorMode !== 'directory' ||
                type === 'tag' ||
                type === 'placeholder'
                  ? html`<span
                      class="group-dot"
                      title="Click to change color"
                      @click=${(e: MouseEvent) => {
                        const input = (
                          e.currentTarget as HTMLElement
                        ).querySelector(
                          'input[type="color"]'
                        ) as HTMLInputElement | null;
                        input?.showPicker?.();
                      }}
                    >
                      <span style="color: ${getTypeColor(type, this.style)}"
                        >●</span
                      >
                      <input
                        type="color"
                        .value=${getTypeColor(type, this.style)}
                        @input=${(e: Event) =>
                          this._emit('style-change', {
                            node: {
                              ...this.style.node,
                              [type]: (e.target as HTMLInputElement).value,
                            },
                          })}
                      />
                    </span>`
                  : ''}
              </div>
            `
          )}
          ${this.groups.length > 0 ? html`<hr class="group-divider" />` : ''}
          ${this.groups.map(
            (group, i) => html`
              <div class="checkbox-row">
                <input
                  type="checkbox"
                  .checked=${group.enabled}
                  @change=${(e: Event) =>
                    this._updateGroup(i, {
                      enabled: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span
                  style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >${group.label} (${this._groupMatchCount(group)})</span
                >
                <span
                  class="group-dot"
                  title="Click to change color"
                  @click=${(e: MouseEvent) => this._openColorPicker(e, i)}
                >
                  <span style="color: ${group.color}">●</span>
                  <input
                    type="color"
                    .value=${group.color}
                    @input=${(e: Event) =>
                      this._updateGroup(i, {
                        color: (e.target as HTMLInputElement).value,
                      })}
                  />
                </span>
                <button
                  class="icon-btn"
                  title="Delete group"
                  @click=${() => this._deleteGroup(i)}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="currentColor"
                  >
                    <path
                      d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </div>
            `
          )}
          ${this._addingGroup
            ? html`
                <div class="add-group-form">
                  <div class="add-group-form-row">
                    <select
                      .value=${this._newGroupProperty}
                      @change=${(e: Event) =>
                        (this._newGroupProperty = (
                          e.target as HTMLSelectElement
                        ).value)}
                    >
                      <option value="type">type</option>
                      <option value="path">path</option>
                      <option value="tag">tag</option>
                      <option value="title">title</option>
                    </select>
                    <foam-autocomplete-input
                      .value=${this._newGroupValue}
                      .options=${this._autocompleteOptions}
                      placeholder=${ControlPanel._MATCH_HINT[
                        this._newGroupProperty
                      ] ?? 'exact'}
                      @value-change=${(e: CustomEvent<string>) =>
                        (this._newGroupValue = e.detail)}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this._confirmAddGroup();
                      }}
                    ></foam-autocomplete-input>
                  </div>
                  <div class="add-group-form-actions">
                    ${this._newGroupValue
                      ? html`<span style="opacity:0.6;font-size:11px;flex:1"
                          >${this._previewMatchCount}
                          note${this._previewMatchCount === 1 ? '' : 's'}
                          match</span
                        >`
                      : html`<span style="flex:1"></span>`}
                    <button
                      class="btn btn-secondary"
                      @click=${() => (this._addingGroup = false)}
                    >
                      Cancel
                    </button>
                    <button class="btn" @click=${this._confirmAddGroup}>
                      Add
                    </button>
                  </div>
                </div>
              `
            : html`
                <button
                  class="add-group-btn"
                  @click=${() => {
                    this._addingGroup = true;
                    this._newGroupValue = '';
                  }}
                >
                  + Add group
                </button>
              `}
        </div>
      </details>

      <details>
        <summary>Appearance</summary>
        <div class="section-content">
          <label class="slider-row">
            <span>Text Fade</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              .value=${String(this.textFade)}
              @input=${(e: Event) =>
                this._emit(
                  'text-fade-change',
                  parseFloat((e.target as HTMLInputElement).value)
                )}
            />
            <span class="value">${this.textFade.toFixed(1)}</span>
          </label>
          <label class="slider-row">
            <span>Font Size</span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              .value=${String(this.nodeFontSizeMultiplier)}
              @input=${(e: Event) =>
                this._emit(
                  'font-size-multiplier-change',
                  parseFloat((e.target as HTMLInputElement).value)
                )}
            />
            <span class="value"
              >${this.nodeFontSizeMultiplier.toFixed(1)}×</span
            >
          </label>
          <label class="slider-row">
            <span>Node Size</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              .value=${String(this.nodeSizeMultiplier)}
              @input=${(e: Event) =>
                this._emit(
                  'node-size-multiplier-change',
                  parseFloat((e.target as HTMLInputElement).value)
                )}
            />
            <span class="value">${this.nodeSizeMultiplier.toFixed(1)}×</span>
          </label>
          <label class="slider-row">
            <span>Link Size</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              .value=${String(this.linkWidthMultiplier)}
              @input=${(e: Event) =>
                this._emit(
                  'link-width-multiplier-change',
                  parseFloat((e.target as HTMLInputElement).value)
                )}
            />
            <span class="value">${this.linkWidthMultiplier.toFixed(1)}×</span>
          </label>
          <label class="select-row">
            <span>Link flow</span>
            <select
              .value=${this.animateLinks}
              @change=${(e: Event) =>
                this._emit(
                  'animate-links-change',
                  (e.target as HTMLSelectElement).value
                )}
            >
              <option value="forward">Forward</option>
              <option value="off">Off</option>
              <option value="reverse">Reverse</option>
            </select>
          </label>
        </div>
      </details>

      <details>
        <summary>Forces</summary>
        <div class="section-content">
          <label class="slider-row">
            <span>Collide</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              .value=${String(this.forces.collide)}
              @input=${(e: Event) =>
                this._emitForcesChange({
                  collide: parseFloat((e.target as HTMLInputElement).value),
                })}
            />
            <span class="value">${this.forces.collide.toFixed(1)}</span>
          </label>
          <label class="slider-row">
            <span>Repel</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              .value=${String(this.forces.repel)}
              @input=${(e: Event) =>
                this._emitForcesChange({
                  repel: parseFloat((e.target as HTMLInputElement).value),
                })}
            />
            <span class="value">${this.forces.repel}</span>
          </label>
          <label class="slider-row">
            <span>Link Dist</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              .value=${String(this.forces.link)}
              @input=${(e: Event) =>
                this._emitForcesChange({
                  link: parseFloat((e.target as HTMLInputElement).value),
                })}
            />
            <span class="value">${this.forces.link}</span>
          </label>
          <label class="slider-row">
            <span>Velocity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              .value=${String(this.forces.velocityDecay)}
              @input=${(e: Event) =>
                this._emitForcesChange({
                  velocityDecay: parseFloat(
                    (e.target as HTMLInputElement).value
                  ),
                })}
            />
            <span class="value">${this.forces.velocityDecay.toFixed(2)}</span>
          </label>
        </div>
      </details>

      <details>
        <summary>Selection</summary>
        <div class="section-content">
          <label class="slider-row">
            <span>Depth</span>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              .value=${String(this.selection.neighborDepth)}
              @input=${(e: Event) =>
                this._emitSelectionChange({
                  neighborDepth: parseInt((e.target as HTMLInputElement).value),
                })}
            />
            <span class="value">${this.selection.neighborDepth}</span>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              .checked=${this.selection.centerOnSelect}
              @change=${(e: Event) =>
                this._emitSelectionChange({
                  centerOnSelect: (e.target as HTMLInputElement).checked,
                })}
            />
            <span>Center on select</span>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              .checked=${this.selection.zoomOnSelect}
              @change=${(e: Event) =>
                this._emitSelectionChange({
                  zoomOnSelect: (e.target as HTMLInputElement).checked,
                })}
            />
            <span>Zoom on select</span>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              .checked=${this.graphScope !== 'full'}
              @change=${(e: Event) =>
                this._emit(
                  'graph-scope-change',
                  (e.target as HTMLInputElement).checked ? { depth: 1 } : 'full'
                )}
            />
            <span>Focus graph</span>
          </label>
          ${this.graphScope !== 'full'
            ? html`<label class="slider-row">
                <span>Focus depth</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  .value=${String((this.graphScope as { depth: number }).depth)}
                  @input=${(e: Event) =>
                    this._emit('graph-scope-change', {
                      depth: parseInt((e.target as HTMLInputElement).value),
                    })}
                />
                <span class="value">${(this.graphScope as { depth: number }).depth}</span>
              </label>`
            : null}
        </div>
      </details>
    `;
  }

  private _emit(eventName: string, detail: unknown) {
    this.dispatchEvent(
      new CustomEvent(eventName, { detail, bubbles: true, composed: true })
    );
  }

  private _emitShowNodesOfTypeChange(type: string, checked: boolean) {
    this._emit('show-nodes-of-type-change', {
      ...this.showNodesOfType,
      [type]: checked,
    });
  }

  private _emitForcesChange(patch: Partial<Forces>) {
    this._emit('forces-change', { ...this.forces, ...patch });
  }

  private _openColorPicker(e: MouseEvent, _index: number) {
    const dot = e.currentTarget as HTMLElement;
    const input = dot.querySelector(
      'input[type="color"]'
    ) as HTMLInputElement | null;
    if (input) input.showPicker?.();
  }

  private _updateGroup(index: number, patch: Partial<GroupRule>) {
    const updated = this.groups.map((g, i) =>
      i === index ? { ...g, ...patch } : g
    );
    this._emit('groups-change', updated);
  }

  private _deleteGroup(index: number) {
    const updated = this.groups.filter((_, i) => i !== index);
    this._emit('groups-change', updated);
  }

  private _confirmAddGroup() {
    if (!this._newGroupValue) return;
    const label = `${this._newGroupProperty}=${this._newGroupValue}`;
    const newGroup: GroupRule = {
      id: `group-${Date.now()}`,
      label,
      color: hashToHSL(hashString(label)),
      enabled: true,
      match: { property: this._newGroupProperty, value: this._newGroupValue },
    };
    this._emit('groups-change', [...this.groups, newGroup]);
    this._addingGroup = false;
  }

  private _emitSelectionChange(patch: Partial<Selection>) {
    this._emit('selection-change', { ...this.selection, ...patch });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'foam-control-panel': ControlPanel;
  }
}

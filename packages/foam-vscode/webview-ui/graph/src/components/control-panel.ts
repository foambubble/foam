import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getNodeTypeColor } from '../lib/colors';
import type { ResolvedStyle, Forces, Selection } from '../lib/types';

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

    select {
      background: var(--vscode-dropdown-background, #3c3c3c);
      color: var(--vscode-dropdown-foreground, #ccc);
      border: 1px solid var(--vscode-dropdown-border, #454545);
      padding: 2px 4px;
      font-size: 12px;
    }
  `;

  @property({ type: Object }) style: ResolvedStyle = {} as ResolvedStyle;
  @property({ type: Object }) showNodesOfType: Record<string, boolean> = {};
  @property({ type: Object }) nodeTypeCounts: Record<string, number> = {};
  @property({ type: Number }) textFade: number = 0;
  @property({ type: Number }) nodeFontSizeMultiplier: number = 1;
  @property({ type: Number }) nodeSizeMultiplier: number = 1.5;
  @property({ type: Number }) linkWidthMultiplier: number = 2;
  @property({ type: String }) animateLinks: 'forward' | 'off' | 'reverse' = 'forward';
  @property({ type: Object }) forces: Forces = {
    collide: 2,
    repel: 30,
    link: 30,
    velocityDecay: 0.4,
  };
  @property({ type: Object }) selection: Selection = {
    neighborDepth: 1,
    enableRefocus: true,
    enableZoom: true,
  };

  private static readonly _SPECIAL_TYPES = ['tag', 'attachment', 'image', 'placeholder'];
  private static readonly _SPECIAL_LABELS: Record<string, string> = {
    tag: 'Show tags',
    attachment: 'Show attachments',
    image: 'Show images',
    placeholder: 'Show placeholders',
  };

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
        <summary>Filter</summary>
        <div class="section-content">
          ${this._specialTypes.map(
            type => html`
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  .checked=${this.showNodesOfType[type]}
                  @change=${(e: Event) =>
                    this._emitShowNodesOfTypeChange(
                      type,
                      (e.target as HTMLInputElement).checked
                    )}
                />
                <span>${ControlPanel._SPECIAL_LABELS[type]} (${this.nodeTypeCounts[type] ?? 0})</span>
              </label>
            `
          )}
        </div>
      </details>

      ${this._noteTypes.length > 0
        ? html`
            <details open>
              <summary>Filter notes by type</summary>
              <div class="section-content">
                ${this._noteTypes.map(
                  type => html`
                    <label class="checkbox-row">
                      <input
                        type="checkbox"
                        .checked=${this.showNodesOfType[type]}
                        @change=${(e: Event) =>
                          this._emitShowNodesOfTypeChange(
                            type,
                            (e.target as HTMLInputElement).checked
                          )}
                      />
                      <span
                        style="color: ${getNodeTypeColor(type, this.style)}"
                      >
                        ${type} (${this.nodeTypeCounts[type] || 0})
                      </span>
                    </label>
                  `
                )}
              </div>
            </details>
          `
        : nothing}

      <details open>
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
              .checked=${this.selection.enableRefocus}
              @change=${(e: Event) =>
                this._emitSelectionChange({
                  enableRefocus: (e.target as HTMLInputElement).checked,
                })}
            />
            <span>Refocus on select</span>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              .checked=${this.selection.enableZoom}
              @change=${(e: Event) =>
                this._emitSelectionChange({
                  enableZoom: (e.target as HTMLInputElement).checked,
                })}
            />
            <span>Zoom on select</span>
          </label>
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

  private _emitSelectionChange(patch: Partial<Selection>) {
    this._emit('selection-change', { ...this.selection, ...patch });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'foam-control-panel': ControlPanel;
  }
}

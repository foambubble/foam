import { LitElement, html, css } from 'lit';
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
      font-size: 11px;
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
      padding: 4px 8px 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    .checkbox-row input[type='checkbox'] {
      margin: 0;
      cursor: pointer;
    }

    .slider-row {
      display: grid;
      grid-template-columns: 60px 1fr 32px;
      align-items: center;
      gap: 4px;
    }

    .slider-row input[type='range'] {
      width: 100%;
      margin: 0;
      accent-color: var(--vscode-focusBorder, #007acc);
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
      font-size: 11px;
    }
  `;

  @property({ type: Object }) style: ResolvedStyle = {} as ResolvedStyle;
  @property({ type: Object }) showNodesOfType: Record<string, boolean> = {};
  @property({ type: Number }) textFade: number = 3.8;
  @property({ type: Number }) nodeFontSizeMultiplier: number = 1;
  @property({ type: Object }) forces: Forces = { collide: 2, repel: 30, link: 30, velocityDecay: 0.4 };
  @property({ type: Object }) selection: Selection = { neighborDepth: 1, enableRefocus: true, enableZoom: true };

  private get _nodeTypes() {
    return Object.keys(this.showNodesOfType).sort();
  }

  render() {
    return html`
      <details open>
        <summary>Filter by type</summary>
        <div class="section-content">
          ${this._nodeTypes.map(type => html`
            <label class="checkbox-row">
              <input
                type="checkbox"
                .checked=${this.showNodesOfType[type]}
                @change=${(e: Event) => this._emitShowNodesOfTypeChange(type, (e.target as HTMLInputElement).checked)}
              />
              <span style="color: ${getNodeTypeColor(type, this.style)}">${type}</span>
            </label>
          `)}
        </div>
      </details>

      <details open>
        <summary>Appearance</summary>
        <div class="section-content">
          <label class="slider-row">
            <span>Text Fade</span>
            <input
              type="range"
              min="0" max="5" step="0.1"
              .value=${String(this.textFade)}
              @input=${(e: Event) => this._emit('text-fade-change', parseFloat((e.target as HTMLInputElement).value))}
            />
            <span class="value">${this.textFade.toFixed(1)}</span>
          </label>
          <label class="slider-row">
            <span>Font Size</span>
            <input
              type="range"
              min="0.5" max="3" step="0.1"
              .value=${String(this.nodeFontSizeMultiplier)}
              @input=${(e: Event) => this._emit('font-size-multiplier-change', parseFloat((e.target as HTMLInputElement).value))}
            />
            <span class="value">${this.nodeFontSizeMultiplier.toFixed(1)}×</span>
          </label>
          <label class="select-row">
            <span>Color by</span>
            <select
              .value=${this.style.colorMode ?? 'none'}
              @change=${(e: Event) => this._emit('style-change', { colorMode: (e.target as HTMLSelectElement).value as 'none' | 'directory' })}
            >
              <option value="none">None</option>
              <option value="directory">Directory</option>
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
              min="0" max="4" step="0.1"
              .value=${String(this.forces.collide)}
              @input=${(e: Event) => this._emitForcesChange({ collide: parseFloat((e.target as HTMLInputElement).value) })}
            />
            <span class="value">${this.forces.collide.toFixed(1)}</span>
          </label>
          <label class="slider-row">
            <span>Repel</span>
            <input
              type="range"
              min="0" max="200" step="1"
              .value=${String(this.forces.repel)}
              @input=${(e: Event) => this._emitForcesChange({ repel: parseFloat((e.target as HTMLInputElement).value) })}
            />
            <span class="value">${this.forces.repel}</span>
          </label>
          <label class="slider-row">
            <span>Link Dist</span>
            <input
              type="range"
              min="0" max="100" step="1"
              .value=${String(this.forces.link)}
              @input=${(e: Event) => this._emitForcesChange({ link: parseFloat((e.target as HTMLInputElement).value) })}
            />
            <span class="value">${this.forces.link}</span>
          </label>
          <label class="slider-row">
            <span>Velocity</span>
            <input
              type="range"
              min="0" max="1" step="0.01"
              .value=${String(this.forces.velocityDecay)}
              @input=${(e: Event) => this._emitForcesChange({ velocityDecay: parseFloat((e.target as HTMLInputElement).value) })}
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
              min="1" max="5" step="1"
              .value=${String(this.selection.neighborDepth)}
              @input=${(e: Event) => this._emitSelectionChange({ neighborDepth: parseInt((e.target as HTMLInputElement).value) })}
            />
            <span class="value">${this.selection.neighborDepth}</span>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              .checked=${this.selection.enableRefocus}
              @change=${(e: Event) => this._emitSelectionChange({ enableRefocus: (e.target as HTMLInputElement).checked })}
            />
            <span>Refocus on select</span>
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              .checked=${this.selection.enableZoom}
              @change=${(e: Event) => this._emitSelectionChange({ enableZoom: (e.target as HTMLInputElement).checked })}
            />
            <span>Zoom on select</span>
          </label>
        </div>
      </details>
    `;
  }

  private _emit(eventName: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
  }

  private _emitShowNodesOfTypeChange(type: string, checked: boolean) {
    this._emit('show-nodes-of-type-change', { ...this.showNodesOfType, [type]: checked });
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

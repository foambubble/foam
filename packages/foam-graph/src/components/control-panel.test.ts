import { describe, expect, it } from 'vitest';

import { ControlPanel } from './control-panel';
import { makeStyle, renderedMarkup } from '../test-utils';

/** The panel in the document, drawn, so its own controls can be activated. */
const mountPanel = async () => {
  const panel = document.createElement('foam-control-panel');
  document.body.append(panel);
  await panel.updateComplete;
  return panel;
};

describe('foam-control-panel', () => {
  // AC-1: the panel carries the control that hides it
  it('draws a labelled control for hiding the panel', () => {
    const panel = new ControlPanel();

    const markup = renderedMarkup(panel.render());

    expect(markup).toContain('class="hide-controls"');
    expect(markup).toContain('aria-label="Hide the controls panel"');
  });

  // AC-1: activating that control is what asks for the panel to go
  it('asks to be hidden when the user activates the hide control', async () => {
    const panel = await mountPanel();
    const events: Event[] = [];
    panel.addEventListener('hide-controls', event => events.push(event));

    panel
      .shadowRoot!.querySelector<HTMLButtonElement>('.hide-controls')!
      .click();

    expect(events).toHaveLength(1);
    panel.remove();
  });

  // AC-6 (#452)
  it('offers Show folders among the built-in types, unchecked while folders are hidden', async () => {
    const panel = await mountPanel();
    panel.style = makeStyle();
    panel.showNodesOfType = { note: true, tag: true, folder: false };
    await panel.updateComplete;
    const events: CustomEvent[] = [];
    panel.addEventListener('toggle-node-type', event =>
      events.push(event as CustomEvent)
    );

    const row = Array.from(
      panel.shadowRoot!.querySelectorAll<HTMLElement>('.checkbox-row')
    ).find(r => r.textContent!.includes('Show folders'))!;
    const checkbox = row.querySelector<HTMLInputElement>(
      'input[type="checkbox"]'
    )!;
    expect(checkbox.checked).toBe(false);

    checkbox.click();

    expect(events.map(event => event.detail)).toEqual([
      { type: 'folder', visible: true },
    ]);
    panel.remove();
  });

  // AC-11 (#452)
  it('offers no folder color when coloring by directory', async () => {
    const panel = await mountPanel();
    panel.style = makeStyle({ colorMode: 'directory' });
    panel.showNodesOfType = { note: true, tag: true, folder: true };
    await panel.updateComplete;

    const row = Array.from(
      panel.shadowRoot!.querySelectorAll<HTMLElement>('.checkbox-row')
    ).find(r => r.textContent!.includes('Show folders'))!;

    expect(row.querySelector('.group-dot')).toBeNull();
    panel.remove();
  });

  it('draws reset only while the view has changed', () => {
    const panel = new ControlPanel();

    panel.viewChanged = false;
    expect(renderedMarkup(panel.render())).not.toContain('class="reset-view"');

    panel.viewChanged = true;
    expect(renderedMarkup(panel.render())).toContain('class="reset-view"');
  });

  it('resets the view from an icon whose tooltip names it', async () => {
    const panel = await mountPanel();
    panel.viewChanged = true;
    await panel.updateComplete;
    const events: Event[] = [];
    panel.addEventListener('reset-view', event => events.push(event));

    const reset =
      panel.shadowRoot!.querySelector<HTMLButtonElement>('.reset-view')!;
    reset.click();

    expect(reset.title).toBe('Reset view');
    expect(reset.getAttribute('aria-label')).toBe('Reset view');
    expect(reset.textContent!.trim()).toBe('');
    expect(events).toHaveLength(1);
    panel.remove();
  });

  // AC-1: a hidden panel draws nothing over the graph, though it is still
  // there — `display: block` on the host would otherwise outrank `hidden`
  it('draws nothing while hidden', async () => {
    const panel = await mountPanel();

    panel.hidden = true;

    expect(getComputedStyle(panel).display).toBe('none');
    panel.remove();
  });

  // AC-2: staying mounted is what keeps the state only the DOM holds, so a
  // section the user collapsed is still collapsed when the panel comes back
  it('keeps a collapsed section collapsed through a hide and a show', async () => {
    const panel = await mountPanel();
    const groups =
      panel.shadowRoot!.querySelector<HTMLDetailsElement>('details')!;
    expect(groups.open).toBe(true);

    groups.open = false;
    panel.hidden = true;
    panel.hidden = false;
    await panel.updateComplete;

    expect(panel.shadowRoot!.querySelector('details')).toBe(groups);
    expect(groups.open).toBe(false);
    panel.remove();
  });
});

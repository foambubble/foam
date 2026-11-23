import { describe, expect, it } from 'vitest';

import { ControlPanel } from './control-panel';
import { renderedMarkup } from '../test-utils';

describe('foam-control-panel', () => {
  // AC-1: the panel carries the control that hides it
  it('draws a labelled control for hiding the panel', () => {
    const panel = new ControlPanel();

    const markup = renderedMarkup(panel.render());

    expect(markup).toContain('class="hide-controls"');
    expect(markup).toContain('aria-label="Hide the controls panel"');
  });
});

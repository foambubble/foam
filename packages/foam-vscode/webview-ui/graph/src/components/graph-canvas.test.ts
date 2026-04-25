import { describe, expect, it } from 'vitest';

import { measureGraphViewport } from './graph-canvas';

describe('measureGraphViewport', () => {
  it('uses the graph element size instead of the browser viewport', () => {
    const element = document.createElement('foam-graph-canvas');
    element.getBoundingClientRect = () =>
      ({
        width: 320,
        height: 180,
      } as DOMRect);

    expect(
      measureGraphViewport(element, { width: 1200, height: 900 })
    ).toEqual({
      width: 320,
      height: 180,
    });
  });

  it('falls back to the parent element size before the browser viewport', () => {
    const parent = document.createElement('foam-graph');
    const element = document.createElement('foam-graph-canvas');
    parent.append(element);
    element.getBoundingClientRect = () =>
      ({
        width: 0,
        height: 0,
      } as DOMRect);
    parent.getBoundingClientRect = () =>
      ({
        width: 240,
        height: 160,
      } as DOMRect);

    expect(
      measureGraphViewport(element, { width: 1200, height: 900 })
    ).toEqual({
      width: 240,
      height: 160,
    });
  });
});

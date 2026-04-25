import { describe, expect, it } from 'vitest';

import {
  computeFitZoom,
  computeLabelOpacity,
  computeLabelFontSize,
  graphPointToViewport,
  measureGraphViewport,
} from './graph-canvas';

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

describe('computeLabelFontSize', () => {
  it('keeps label font size independent from graph zoom', () => {
    expect(computeLabelFontSize(12, 1)).toBe(12);
  });

  it('applies the configured label size multiplier', () => {
    expect(computeLabelFontSize(12, 1.5)).toBe(18);
  });
});

describe('computeLabelOpacity', () => {
  it('keeps labels fully visible when always-show labels is enabled', () => {
    expect(computeLabelOpacity('regular', 0.5, 0.4, () => 0, 'always')).toBe(1);
  });

  it('preserves regular zoom-dependent label fading by default', () => {
    expect(computeLabelOpacity('regular', 0.5, 0.4, () => 0.25, { fade: 0 })).toBe(
      0.25
    );
  });

  it('keeps highlighted labels fully visible by default', () => {
    expect(computeLabelOpacity('highlighted', 0.5, 0.4, () => 0, { fade: 0 })).toBe(1);
  });
});

describe('graphPointToViewport', () => {
  it('converts graph coordinates through the current canvas transform', () => {
    const transform = {
      a: 2,
      b: 0,
      c: 0,
      d: 2,
      e: 20,
      f: 30,
    } as DOMMatrixReadOnly;

    expect(graphPointToViewport(transform, 10, 15, 1)).toEqual({
      x: 40,
      y: 60,
    });
  });

  it('returns CSS pixel coordinates when the canvas is scaled for device pixels', () => {
    const transform = {
      a: 4,
      b: 0,
      c: 0,
      d: 4,
      e: 40,
      f: 60,
    } as DOMMatrixReadOnly;

    expect(graphPointToViewport(transform, 10, 15, 2)).toEqual({
      x: 40,
      y: 60,
    });
  });
});

describe('computeFitZoom', () => {
  it('computes the zoom needed to fit bounds into the viewport', () => {
    expect(
      computeFitZoom({ x: [0, 100], y: [0, 50] }, { width: 220, height: 120 }, 10)
    ).toBe(2);
  });

  it('caps the fit zoom when a max zoom is provided', () => {
    expect(
      computeFitZoom(
        { x: [0, 100], y: [0, 50] },
        { width: 220, height: 120 },
        10,
        1.4
      )
    ).toBe(1.4);
  });

  it('does not increase a smaller fit zoom to the cap', () => {
    expect(
      computeFitZoom(
        { x: [0, 200], y: [0, 100] },
        { width: 220, height: 120 },
        10,
        1.4
      )
    ).toBe(1);
  });
});

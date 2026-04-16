import { describe, it, expect } from 'vitest';
import { resolveStyle, mergeStyles } from './style';
import { makeStyle } from '../test-utils';
import type { GraphStyle } from '../protocol';

describe('resolveStyle', () => {
  const defaults = makeStyle();

  it('returns defaults when payload is null', () => {
    expect(resolveStyle(null, defaults)).toEqual(defaults);
  });

  it('applies background from payload.style', () => {
    const result = resolveStyle({ style: { background: '#ff0000' } }, defaults);
    expect(result.background).toBe('#ff0000');
  });

  it('leaves other defaults untouched when only one property is overridden', () => {
    const result = resolveStyle({ style: { background: '#ff0000' } }, defaults);
    expect(result.fontSize).toBe(defaults.fontSize);
    expect(result.lineColor).toBe(defaults.lineColor);
    expect(result.node).toEqual(defaults.node);
  });

  it('applies font settings from payload.style', () => {
    const result = resolveStyle(
      { style: { fontSize: 16, fontFamily: 'Monospace' } },
      defaults
    );
    expect(result.fontSize).toBe(16);
    expect(result.fontFamily).toBe('Monospace');
  });

  it('applies node colors from payload.style.node', () => {
    const result = resolveStyle(
      { style: { node: { note: '#abcdef' } } },
      defaults
    );
    expect(result.node.note).toBe('#abcdef');
    expect(result.node.placeholder).toBe(defaults.node.placeholder);
  });

  it('uses explicit lineColor from payload.style', () => {
    const result = resolveStyle({ style: { lineColor: '#123456' } }, defaults);
    expect(result.lineColor).toBe('#123456');
  });

  it('falls back to node.note as lineColor when lineColor is not set', () => {
    const result = resolveStyle(
      { style: { node: { note: '#aabbcc' } } },
      defaults
    );
    expect(result.lineColor).toBe('#aabbcc');
  });

  it('applies colorMode from payload', () => {
    const result = resolveStyle({ colorMode: 'directory' }, defaults);
    expect(result.colorMode).toBe('directory');
  });

  it('keeps default colorMode when payload does not specify one', () => {
    const result = resolveStyle({ style: { background: '#ff0000' } }, defaults);
    expect(result.colorMode).toBe(defaults.colorMode);
  });

  // Regression test for https://github.com/foambubble/foam/issues/1620
  //
  // The extension was sending the raw StyleConfig (foam.graph.style) directly
  // as the message payload instead of wrapping it in { style: StyleConfig }.
  // This meant payload.style was always undefined and user settings were silently
  // dropped in favour of theme defaults.
  it('does not apply settings when payload.style is absent (documents the #1620 failure mode)', () => {
    const buggyPayload = { background: '#ff0000' } as unknown as GraphStyle;
    const result = resolveStyle(buggyPayload, defaults);
    expect(result.background).toBe(defaults.background);
    expect(result.background).not.toBe('#ff0000');
  });
});

describe('mergeStyles', () => {
  it('patch overrides base style properties', () => {
    const base: GraphStyle = { style: { background: '#111111', fontSize: 10 } };
    const patch: GraphStyle = { style: { background: '#222222' } };
    const merged = mergeStyles(base, patch);
    expect(merged.style?.background).toBe('#222222');
    expect(merged.style?.fontSize).toBe(10);
  });

  it('patch overrides colorMode', () => {
    const base: GraphStyle = { colorMode: 'none' };
    const patch: GraphStyle = { colorMode: 'directory' };
    expect(mergeStyles(base, patch).colorMode).toBe('directory');
  });

  it('handles null base', () => {
    const patch: GraphStyle = { style: { background: '#ff0000' } };
    const merged = mergeStyles(null, patch);
    expect(merged.style?.background).toBe('#ff0000');
  });
});

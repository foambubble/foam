import { describe, expect, it } from 'vitest';
import { getNodeRadius } from './node-style';
import { makeNode, makeStyle } from '../test-utils';

const withLinks = (count: number, type = 'note') =>
  makeNode({
    type,
    neighbors: Array.from({ length: count }, (_, i) => `${i}`),
  });

describe('getNodeRadius (AC-3)', () => {
  const style = makeStyle({ nodeStyle: { note: { size: 4 } } });

  it('gives every node of a type with a fixed size that size, whatever its link count', () => {
    expect(getNodeRadius(withLinks(0), style, 1)).toBe(4);
    expect(getNodeRadius(withLinks(30), style, 1)).toBe(4);
  });

  it('grows the nodes of a type with no size set with their link count', () => {
    expect(getNodeRadius(withLinks(0, 'tag'), style, 1)).toBeCloseTo(0.6);
    expect(getNodeRadius(withLinks(30, 'tag'), style, 1)).toBeCloseTo(3);
  });

  it('scales fixed and link-count sizes alike by the node size multiplier', () => {
    expect(getNodeRadius(withLinks(0), style, 2)).toBe(8);
    expect(getNodeRadius(withLinks(0, 'tag'), style, 2)).toBeCloseTo(1.2);
  });
});

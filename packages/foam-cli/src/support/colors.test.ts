import { afterEach, describe, it, expect } from 'vitest';
import {
  bold,
  dim,
  error,
  success,
  warning,
  path,
  colorsEnabled,
  setColorsEnabled,
} from './colors';

const RESET = '\x1b[0m';

describe('color helpers when enabled', () => {
  afterEach(() => {
    setColorsEnabled(false);
  });

  it('reports enabled state', () => {
    setColorsEnabled(true);
    expect(colorsEnabled()).toBe(true);
  });

  it('wraps bold in the bold ANSI sequence', () => {
    setColorsEnabled(true);
    expect(bold('x')).toBe(`\x1b[1mx${RESET}`);
  });

  it('wraps dim in the dim ANSI sequence', () => {
    setColorsEnabled(true);
    expect(dim('x')).toBe(`\x1b[2mx${RESET}`);
  });

  it('wraps error in the red ANSI sequence', () => {
    setColorsEnabled(true);
    expect(error('x')).toBe(`\x1b[31mx${RESET}`);
  });

  it('wraps success in the green ANSI sequence', () => {
    setColorsEnabled(true);
    expect(success('x')).toBe(`\x1b[32mx${RESET}`);
  });

  it('wraps warning in the yellow ANSI sequence', () => {
    setColorsEnabled(true);
    expect(warning('x')).toBe(`\x1b[33mx${RESET}`);
  });

  it('wraps path in the cyan ANSI sequence', () => {
    setColorsEnabled(true);
    expect(path('x')).toBe(`\x1b[36mx${RESET}`);
  });

  it('always closes with the reset code', () => {
    setColorsEnabled(true);
    for (const helper of [bold, dim, error, success, warning, path]) {
      expect(helper('hello').endsWith(RESET)).toBe(true);
    }
  });
});

describe('color helpers when disabled', () => {
  it('reports disabled state', () => {
    setColorsEnabled(false);
    expect(colorsEnabled()).toBe(false);
  });

  it('returns input unchanged for every helper', () => {
    setColorsEnabled(false);
    for (const helper of [bold, dim, error, success, warning, path]) {
      expect(helper('hello')).toBe('hello');
    }
  });
});

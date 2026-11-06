import { describe, expect, it } from 'vitest';
import { truncateLabel } from './labels';

// AC-3: labels longer than the truncation length are shortened with an
// ellipsis at render time, for every node type; 0 or less disables.
describe('truncateLabel', () => {
  it('keeps a label shorter than the limit', () => {
    expect(truncateLabel('short', 24)).toBe('short');
  });

  it('keeps a label exactly at the limit', () => {
    expect(truncateLabel('a'.repeat(24), 24)).toBe('a'.repeat(24));
  });

  it('truncates a longer label with an ellipsis', () => {
    expect(truncateLabel('a'.repeat(30), 24)).toBe('a'.repeat(24) + '...');
  });

  it('truncates a placeholder-style path label like any other', () => {
    expect(
      truncateLabel('/F:/Directory/sub/dir/some-file.html', 10)
    ).toBe('/F:/Direct...');
  });

  it('renders the full label when the limit is 0', () => {
    expect(truncateLabel('a'.repeat(100), 0)).toBe('a'.repeat(100));
  });

  it('renders the full label when the limit is negative', () => {
    expect(truncateLabel('a'.repeat(100), -1)).toBe('a'.repeat(100));
  });
});

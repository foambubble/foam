import { describe, it, expect } from 'vitest';
import { parseWhatsNewTitle, computeContentHash } from './whats-new';

describe('parseWhatsNewTitle', () => {
  it('returns the h1 heading text', () => {
    const content = `# What's new in Foam\n\nSome description here.`;
    expect(parseWhatsNewTitle(content)).toBe("What's new in Foam");
  });

  it('trims whitespace from the heading', () => {
    const content = `#   What's new   \n\nSome description here.`;
    expect(parseWhatsNewTitle(content)).toBe("What's new");
  });

  it('returns undefined when there is no h1 heading', () => {
    const content = `## Not a top-level heading\n\nSome description.`;
    expect(parseWhatsNewTitle(content)).toBeUndefined();
  });

  it('returns undefined for empty content', () => {
    expect(parseWhatsNewTitle('')).toBeUndefined();
  });

  it('picks the first h1 heading when there are multiple', () => {
    const content = `# First Heading\n\n# Second Heading\n\nContent.`;
    expect(parseWhatsNewTitle(content)).toBe('First Heading');
  });
});

describe('computeContentHash', () => {
  it('returns the same hash for identical content', () => {
    const content = '# What\'s new in Foam\n\nSome description.';
    expect(computeContentHash(content)).toBe(computeContentHash(content));
  });

  it('returns different hashes for different content', () => {
    expect(computeContentHash('# Version A')).not.toBe(
      computeContentHash('# Version B')
    );
  });

  it('returns different hash when only whitespace changes', () => {
    expect(computeContentHash('# Title\n\nBody.')).not.toBe(
      computeContentHash('# Title\n\nBody. ')
    );
  });
});

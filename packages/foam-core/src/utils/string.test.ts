import { isSubsequence } from './string';

describe('isSubsequence', () => {
  it('returns true when every query char appears in order', () => {
    expect(isSubsequence('alt', 'alternative')).toBe(true);
    expect(isSubsequence('cmpy', 'contemporary')).toBe(true);
    expect(isSubsequence('abc', 'abc')).toBe(true);
  });

  it('returns true when query equals candidate', () => {
    expect(isSubsequence('hello', 'hello')).toBe(true);
  });

  it('returns false when characters appear out of order', () => {
    expect(isSubsequence('sotn', 'notes')).toBe(false);
    expect(isSubsequence('cba', 'abc')).toBe(false);
  });

  it('returns false when a character is missing', () => {
    expect(isSubsequence('xyz', 'abc')).toBe(false);
    expect(isSubsequence('alts', 'alternative')).toBe(false);
  });

  it('treats empty query as a trivial match', () => {
    expect(isSubsequence('', 'anything')).toBe(true);
    expect(isSubsequence('', '')).toBe(true);
  });

  it('returns false when candidate is empty and query is not', () => {
    expect(isSubsequence('a', '')).toBe(false);
  });

  it('is case-sensitive (callers lowercase if needed)', () => {
    expect(isSubsequence('alt', 'Alternative')).toBe(false);
    expect(isSubsequence('Alt', 'Alternative')).toBe(true);
  });
});

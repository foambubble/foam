/**
 * Returns true if `query` is a subsequence of `candidate` — that is, every
 * character of `query` appears in `candidate` in the same order, but not
 * necessarily contiguously. Comparison is character-by-character on the
 * exact strings; pass already-lowercased inputs for a case-insensitive
 * check.
 *
 * This is the matching style VS Code uses for its symbol search and is
 * useful for fuzzy-find UX where users type a few distinctive characters
 * rather than full substrings.
 *
 * Examples (lowercased):
 *   isSubsequence('alt', 'alternative')   // true  (a-l-t in order)
 *   isSubsequence('cmpy', 'contemporary') // true  (c-m-p-y in order)
 *   isSubsequence('sotn', 'notes')        // false (n-o-t-e-s, wrong order)
 *   isSubsequence('', 'anything')         // true  (empty query trivially matches)
 *
 * Time complexity is O(|candidate|): the function scans `candidate` once
 * and advances through `query` only on a match.
 */
export function isSubsequence(query: string, candidate: string): boolean {
  let qi = 0;
  for (let i = 0; i < candidate.length && qi < query.length; i++) {
    if (candidate[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

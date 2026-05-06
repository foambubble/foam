import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';
import { isSubsequence } from '../utils/string';

export interface SearchMatch {
  id: string;
  uri: URI;
  title: string;
  type: string;
  tags: string[];
  properties: Record<string, unknown>;
  line: number;
  text: string;
  context_before?: string[];
  context_after?: string[];
}

export interface PropertyFilter {
  key: string;
  /** undefined means "has the property" (any value) */
  value?: string;
}

export interface SearchOptions {
  query?: string;
  tags?: string[];
  properties?: PropertyFilter[];
  type?: string;
  limit?: number;
  context?: number;
  /**
   * How to match `query` against titles and aliases.
   *
   * - `'substring'` (default): the query must appear as a contiguous substring,
   *   case-insensitive. Suitable for `foam search` and similar UX.
   * - `'subsequence'`: the query characters must appear in the candidate in
   *   order but not necessarily contiguous, case-insensitive. Matches VS
   *   Code's `Ctrl+T` symbol-search behavior — `"alt"` matches `"alternative"`.
   */
  matchMode?: 'substring' | 'subsequence';
}


/**
 * Searches the Foam workspace index by title, alias, tag, and/or frontmatter
 * property. Returns one match per note (matched on the title line).
 *
 * This is an in-memory query over the workspace index — it does not read
 * note bodies. For full-text content search, use the file content directly.
 */
export function searchWorkspace(
  workspace: FoamWorkspace,
  opts: SearchOptions
): SearchMatch[] {
  const limit = opts.limit ?? 20;
  const context = opts.context ?? 0;
  let resources = workspace.list();

  if (opts.type) {
    resources = resources.filter(r => r.type === opts.type);
  }

  if (opts.tags && opts.tags.length > 0) {
    resources = resources.filter(r =>
      opts.tags!.every(tag => r.tags.some(t => t.label === tag))
    );
  }

  if (opts.properties && opts.properties.length > 0) {
    resources = resources.filter(r =>
      opts.properties!.every(pf => {
        if (!(pf.key in r.properties)) return false;
        if (pf.value === undefined) return true;
        return String(r.properties[pf.key]) === pf.value;
      })
    );
  }

  if (opts.query) {
    const q = opts.query.toLowerCase();
    const matches = (candidate: string | undefined): boolean => {
      if (!candidate) return false;
      const c = candidate.toLowerCase();
      return opts.matchMode === 'subsequence'
        ? isSubsequence(q, c)
        : c.includes(q);
    };
    resources = resources.filter(
      r => matches(r.title) || r.aliases.some(a => matches(a.title))
    );
  }

  resources = resources.slice(0, limit);

  return resources.map(r => {
    const titleLine = `# ${r.title}`;

    const match: SearchMatch = {
      id: workspace.getIdentifier(r.uri),
      uri: r.uri,
      title: r.title,
      type: r.type,
      tags: r.tags.map(t => t.label),
      properties: r.properties as Record<string, unknown>,
      line: 1,
      text: titleLine,
    };

    if (context > 0) {
      match.context_before = [];
      match.context_after = [];
    }

    return match;
  });
}

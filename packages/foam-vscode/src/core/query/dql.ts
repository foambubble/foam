import { parse as parseYaml } from 'yaml';
import { FoamWorkspace } from '../model/workspace';
import { FoamGraph } from '../model/graph';
import { QueryDescriptor, executeQuery, ALL_QUERY_FIELDS } from '.';
import { escapeHtml, renderResults } from './html';

const DQL_PLACEHOLDER = `<div class="foam-query-placeholder">
<p>Use <code>\`\`\`foam-query</code> blocks to write a query to list notes. For example:</p>
<pre>\`\`\`foam-query
filter: "#recipe"
sort: title ASC
\`\`\`</pre>
<pre>\`\`\`foam-query
filter: "#recipe"
select: [title, tags, backlink-count]
format: table
\`\`\`</pre>
<p><strong>Filter examples:</strong></p>
<pre>filter: "#tag"            # notes tagged with #tag
filter: "[[note-id]]"     # notes linked to or from note (same id as in wikilinks)
filter: "*"               # all notes
filter: "/path/regex/"    # notes whose path matches a regex
filter:
  tag: recipe             # object form — same as "#recipe"
filter:
  and:
    - "#recipe"
    - "#published"        # notes matching all conditions
filter:
  or:
    - "#recipe"
    - "#cooking"          # notes matching any condition
filter:
  not: "#draft"           # notes not matching a condition</pre>
<pre>\`\`\`foam-query
filter: "#recipe"
select: [title, properties.status, properties.date]
format: table
\`\`\`</pre>
<p>Read the full documentation <a href="https://github.com/foambubble/foam/blob/main/docs/user/features/foam-queries.md">here</a></p>
</div>`;

const KNOWN_FIELDS = new Set<string>([
  'filter',
  'select',
  'sort',
  'limit',
  'offset',
  'format',
]);

const VALID_FORMATS = new Set(['list', 'table', 'count']);

/**
 * Validates a known field value. Returns an HTML warning string if invalid,
 * null if valid. Only called for non-null, non-empty-string values.
 */
function validateFieldValue(key: string, value: unknown): string | null {
  switch (key) {
    case 'filter':
      if (
        typeof value !== 'string' &&
        (typeof value !== 'object' || Array.isArray(value))
      ) {
        return `Field <code>filter</code> must be a string like <code>"#tag"</code> or a mapping — use <code>*</code> to match all notes`;
      }
      break;
    case 'select': {
      const available = ALL_QUERY_FIELDS.map(f => `<code>${f}</code>`).join(
        ', '
      );
      if (!Array.isArray(value)) {
        return `Field <code>select</code> must be a list of fields. Available: ${available}`;
      }
      if (value.length === 0) {
        return `Field <code>select</code> requires at least one field. Available: ${available}`;
      }
      break;
    }
    case 'sort':
      if (typeof value !== 'string') {
        return `Field <code>sort</code> must be a string like <code>title ASC</code>`;
      }
      break;
    case 'limit':
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        return `Field <code>limit</code> must be a positive integer`;
      }
      break;
    case 'offset':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        return `Field <code>offset</code> must be a non-negative integer`;
      }
      break;
    case 'format':
      if (!VALID_FORMATS.has(value as string)) {
        return `Field <code>format</code> must be one of: <code>list</code>, <code>table</code>, <code>count</code>`;
      }
      break;
  }
  return null;
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) return '';
  const items = warnings.map(w => `<p>${w}</p>`).join('');
  return `<div class="foam-query-warning">${items}</div>`;
}

export function renderDqlQuery(
  content: string,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  trusted: boolean,
  toRelativePath: (path: string) => string
): string {
  if (content.trim() === '') {
    return DQL_PLACEHOLDER;
  }

  const warnings: string[] = [];
  let parsed: Record<string, unknown> = {};

  try {
    parsed = (parseYaml(content) as Record<string, unknown>) ?? {};
  } catch (e) {
    // Try progressively shorter content (drop lines from the end) until we get
    // a valid parse, then warn about the first dropped line.
    const lines = content.split('\n');
    let recovered = false;
    for (let i = lines.length - 1; i >= 1; i--) {
      const truncated = lines.slice(0, i).join('\n');
      if (truncated.trim() === '') break;
      try {
        parsed = (parseYaml(truncated) as Record<string, unknown>) ?? {};
        warnings.push(`Line ${i + 1} has a syntax error and was ignored`);
        recovered = true;
        break;
      } catch {
        // keep trying shorter
      }
    }
    if (!recovered) {
      return (
        DQL_PLACEHOLDER +
        `<div class="foam-query-error">YAML parse error: ${escapeHtml(
          (e as Error).message
        )}</div>`
      );
    }
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return DQL_PLACEHOLDER;
  }

  let filterIsEmpty = false;
  for (const key of Object.keys(parsed)) {
    if (!KNOWN_FIELDS.has(key)) {
      warnings.push(`Unknown field <code>${escapeHtml(key)}</code> — ignored`);
      delete parsed[key];
    } else if (parsed[key] === null || parsed[key] === '') {
      if (key === 'filter') {
        filterIsEmpty = true;
        warnings.push(
          `Field <code>filter</code> requires a value — use <code>*</code> to match all notes`
        );
      } else {
        warnings.push(
          `Missing value for field <code>${escapeHtml(key)}</code> — ignored`
        );
      }
      delete parsed[key];
    } else {
      const warning = validateFieldValue(key, parsed[key]);
      if (warning) {
        if (key === 'filter') filterIsEmpty = true;
        warnings.push(warning);
        delete parsed[key];
      }
    }
  }

  if (Object.keys(parsed).length === 0 || filterIsEmpty) {
    return DQL_PLACEHOLDER + renderWarnings(warnings);
  }

  // Validate individual elements of the select array.
  // Allow known fields and properties.X dot-notation; strip and warn otherwise.
  if (Array.isArray(parsed.select)) {
    const validFields = ALL_QUERY_FIELDS.join(', ');
    const valid: string[] = [];
    for (const field of parsed.select as string[]) {
      if (ALL_QUERY_FIELDS.includes(field) || /^properties\..+$/.test(field)) {
        valid.push(field);
      } else {
        warnings.push(
          `Unknown select field <code>${escapeHtml(
            field
          )}</code> — available: ${validFields}, or <code>properties.fieldname</code>`
        );
      }
    }
    if (valid.length === 0) {
      delete parsed.select; // fall back to default
    } else {
      parsed.select = valid;
    }
  }

  const descriptor = parsed as QueryDescriptor;

  // Ensure path is always fetched when title is selected so link generation
  // works in both list and table formats, even if the user didn't select path.
  const needsPath =
    descriptor.select &&
    descriptor.select.includes('title') &&
    !descriptor.select.includes('path');
  const execDescriptor: QueryDescriptor = needsPath
    ? { ...descriptor, select: [...descriptor.select, 'path'] }
    : descriptor;

  const results = executeQuery(execDescriptor, workspace, graph, { trusted });
  return (
    renderWarnings(warnings) +
    renderResults(results, descriptor, toRelativePath)
  );
}

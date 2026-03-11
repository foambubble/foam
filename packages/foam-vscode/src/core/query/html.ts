import { QueryDescriptor, ResourceView } from '.';

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function noteLink(
  title: string,
  uriPath: string,
  toRelativePath: (path: string) => string
): string {
  try {
    const rel = toRelativePath(uriPath);
    const href = `/${rel}`;
    return `<a class='foam-note-link' title='${escapeHtml(
      title
    )}' href='${href}' data-href='${href}'>${escapeHtml(title)}</a>`;
  } catch {
    return escapeHtml(title);
  }
}

function cellValue(
  field: string,
  value: unknown,
  row: ResourceView,
  toRelativePath: (path: string) => string
): string {
  if (field === 'title' && typeof row.path === 'string' && row.path) {
    return noteLink(String(value ?? ''), row.path, toRelativePath);
  }
  if (Array.isArray(value)) return escapeHtml(value.join(', '));
  if (value === undefined || value === null) return '';
  return escapeHtml(String(value));
}

export function renderList(
  results: ResourceView[],
  toRelativePath: (path: string) => string
): string {
  if (results.length === 0) {
    return '<p class="foam-query-empty">No results</p>';
  }
  const items = results
    .map(r => {
      const title = String(r.title ?? '');
      const path = typeof r.path === 'string' ? r.path : '';
      const link = path
        ? noteLink(title, path, toRelativePath)
        : escapeHtml(title);
      return `<li>${link}</li>`;
    })
    .join('\n');
  return `<ul class="foam-query-results">\n${items}\n</ul>`;
}

export function renderTable(
  results: ResourceView[],
  fields: string[],
  toRelativePath: (path: string) => string
): string {
  if (results.length === 0) {
    return '<p class="foam-query-empty">No results</p>';
  }
  const headers = fields.map(f => `<th>${escapeHtml(f)}</th>`).join('');
  const rows = results
    .map(r => {
      const cells = fields
        .map(f => `<td>${cellValue(f, r[f], r, toRelativePath)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n');
  return (
    `<table class="foam-query-results">\n` +
    `<thead><tr>${headers}</tr></thead>\n` +
    `<tbody>\n${rows}\n</tbody>\n` +
    `</table>`
  );
}

export function renderCount(results: ResourceView[]): string {
  const n = results.length;
  return `<span class="foam-query-results">${n} note${
    n === 1 ? '' : 's'
  }</span>`;
}

/**
 * Renders query results as HTML based on the descriptor's format.
 * When format is 'list', results must contain at least 'title' and 'path'.
 */
export function renderResults(
  results: ResourceView[],
  descriptor: QueryDescriptor,
  toRelativePath: (path: string) => string
): string {
  const format =
    descriptor.format ??
    (descriptor.select && descriptor.select.length > 1 ? 'table' : 'list');
  switch (format) {
    case 'table':
      return renderTable(
        results,
        descriptor.select ?? ['title', 'path'],
        toRelativePath
      );
    case 'count':
      return renderCount(results);
    default:
      return renderList(results, toRelativePath);
  }
}

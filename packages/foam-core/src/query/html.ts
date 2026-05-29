import {
  QueryDescriptor,
  ResourceView,
  requiresSource,
  DEFAULT_SELECT,
  DEFAULT_LIST_SELECT,
} from '.';
import { RenderContext } from './render-context';
import { URI } from '../model/uri';

/**
 * Markdown → HTML callback injected by the host. When omitted, markdown-bearing
 * cells fall back to escaped raw text (CLI / MCP behaviour). `sourceUri`
 * identifies the resource the markdown came from — used by adapters to
 * rewrite intra-note links and to guard against rendering cycles.
 */
export interface MarkdownRenderOptions {
  sourceUri?: URI;
}
export type MarkdownRenderer = (
  markdown: string,
  opts?: MarkdownRenderOptions
) => string;

function renderCell(
  field: string,
  value: unknown,
  row: ResourceView,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): string {
  if (value == null) return '';
  if (renderMarkdown && requiresSource(field)) {
    const sourceUri = row.uri;
    const entered = context ? context.enter(sourceUri) : false;
    if (context && !entered) {
      return `<span class="foam-query-cycle">cycle: <code>${escapeHtml(
        sourceUri.path
      )}</code></span>`;
    }
    try {
      return renderMarkdown(String(value), { sourceUri });
    } finally {
      if (entered) context!.exit(sourceUri);
    }
  }
  if (Array.isArray(value)) return escapeHtml(value.join(', '));
  return escapeHtml(String(value));
}

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
    const href = encodeURI(`/${rel}`);
    return `<a class="foam-note-link" title="${escapeHtml(
      title
    )}" href="${href}" data-href="${href}">${escapeHtml(title)}</a>`;
  } catch {
    return escapeHtml(title);
  }
}

/** Title → basename → `<untitled>`, so a title link is never visibly empty. */
function titleText(value: unknown, uriPath: string): string {
  if (value != null && String(value).length > 0) return String(value);
  const basename = uriPath.split('/').filter(Boolean).pop();
  return basename && basename.length > 0 ? basename : '<untitled>';
}

function cellValue(
  field: string,
  value: unknown,
  row: ResourceView,
  toRelativePath: (path: string) => string,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): string {
  if (field === 'title') {
    return noteLink(
      titleText(value, row.uri.path),
      row.uri.path,
      toRelativePath
    );
  }
  return renderCell(field, value, row, renderMarkdown, context);
}

export function renderList(
  results: ResourceView[],
  fields: string[],
  toRelativePath: (path: string) => string,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): string {
  if (results.length === 0) {
    return '<p class="foam-query-empty">No results</p>';
  }
  const items = results
    .map(r => {
      const path = r.uri.path;
      const parts = fields
        .map(field => {
          const value = r[field];
          if (field === 'title') {
            return noteLink(titleText(value, path), path, toRelativePath);
          }
          return renderCell(field, value, r, renderMarkdown, context);
        })
        .filter(Boolean);
      return parts.length > 0 ? `<li>${parts.join(' · ')}</li>` : null;
    })
    .filter((item): item is string => item !== null)
    .join('\n');
  if (items.length === 0) {
    return '<p class="foam-query-empty">No results</p>';
  }
  return `<ul class="foam-query-results">\n${items}\n</ul>`;
}

export function renderTable(
  results: ResourceView[],
  fields: string[],
  toRelativePath: (path: string) => string,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): string {
  if (results.length === 0) {
    return '<p class="foam-query-empty">No results</p>';
  }
  const headers = fields.map(f => `<th>${escapeHtml(f)}</th>`).join('');
  const rows = results
    .map(r => {
      const cells = fields
        .map(
          f =>
            `<td>${cellValue(
              f,
              r[f],
              r,
              toRelativePath,
              renderMarkdown,
              context
            )}</td>`
        )
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
 */
export function renderResults(
  results: ResourceView[],
  descriptor: QueryDescriptor,
  toRelativePath: (path: string) => string,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): string {
  const format =
    descriptor.format ??
    (descriptor.select && descriptor.select.length > 1 ? 'table' : 'list');
  switch (format) {
    case 'table':
      return renderTable(
        results,
        descriptor.select ?? DEFAULT_SELECT,
        toRelativePath,
        renderMarkdown,
        context
      );
    case 'count':
      return renderCount(results);
    default:
      return renderList(
        results,
        descriptor.select ?? DEFAULT_LIST_SELECT,
        toRelativePath,
        renderMarkdown,
        context
      );
  }
}

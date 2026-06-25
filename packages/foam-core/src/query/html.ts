import {
  QueryDescriptor,
  ResourceView,
  requiresSource,
  DEFAULT_SELECT,
  DEFAULT_LIST_SELECT,
  SelectEntry,
  SelectInput,
  normalizeSelectEntry,
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

/**
 * Builds the `href` value for a note link in query output. Returning `null`
 * tells `noteLink` to render the title as plain text (no anchor) — used by
 * the report renderer to drop links to notes that aren't part of the report.
 *
 * The hook receives the full `URI`, including any `fragment`, so callers can
 * route section-targeted query results (e.g. `[[note#section]]` results) to
 * section anchors when their output scheme supports them.
 */
export type ToHref = (uri: URI) => string | null;

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a query result as an anchor (or plain text). The host's `toHref`
 * owns the full href shape — `noteLink` doesn't prefix, encode, or otherwise
 * massage the returned string.
 *
 * Returning `null` from `toHref` is the explicit "no link" signal: useful
 * when the target is out of the host's output scope (e.g. not included in a
 * report). A thrown error is still caught as a safety net and falls back to
 * plain text too, but `null` is the documented path.
 */
export function noteLink(
  title: string,
  uri: URI,
  toHref: ToHref
): string {
  let href: string | null;
  try {
    href = toHref(uri);
  } catch {
    href = null;
  }
  if (href === null) {
    return escapeHtml(title);
  }
  const safeHref = escapeHtml(href);
  return `<a class="foam-note-link" title="${escapeHtml(
    title
  )}" href="${safeHref}" data-href="${safeHref}">${escapeHtml(title)}</a>`;
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
  toHref: ToHref,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): string {
  if (field === 'title') {
    return noteLink(titleText(value, row.uri.path), row.uri, toHref);
  }
  return renderCell(field, value, row, renderMarkdown, context);
}

/**
 * Coarse description of the HTML a query renderer produced. Consumers of the
 * `onDidRender` hook on `markdownItFoamQuery` use this to decide how (or
 * whether) to wrap the result without having to inspect the HTML string.
 *
 * - `'table'` / `'list'` / `'count'`: shape of the successful render.
 * - `'empty'`: the renderer produced the empty-state placeholder because the
 *   underlying result set was empty.
 * - `'unknown'`: emitted by `renderJsQuery`, where the user's script can call
 *   `render(value)` arbitrarily many times with arbitrary inputs, so the
 *   output is an opaque concatenation.
 */
export type QueryResultShape =
  | 'table'
  | 'list'
  | 'count'
  | 'empty'
  | 'unknown';

/** What every query renderer in this module returns: the HTML plus the
 * shape that produced it. Errors are not represented here — they're a
 * fence-rule concern, surfaced via `FoamQueryRenderEvent.shape === 'error'`. */
export interface QueryRender {
  html: string;
  shape: QueryResultShape;
}

/**
 * Event fired by the `markdownItFoamQuery` plugin after a single foam-query
 * (or foam-query-js) fence has been rendered. Consumers receive the rendered
 * HTML plus a coarse shape tag so they can wrap, decorate, or strip the
 * output without inspecting it.
 *
 * Note on warnings: DQL prepends a `foam-query-warning` block to its result
 * HTML when validation issues come up. The block is included in `html` (we
 * don't split it out); `shape` describes the underlying result, not the
 * warnings.
 */
export interface FoamQueryRenderEvent {
  /** Which fence kind produced this. */
  info: 'foam-query' | 'foam-query-js';
  /** The HTML the renderer produced. */
  html: string;
  /**
   * Result shape, with the added `'error'` case for when the fence rule's
   * try/catch caught an exception — those don't appear in a renderer's own
   * return value (since the renderer never finished).
   */
  shape: QueryResultShape | 'error';
}

const EMPTY_RESULT: QueryRender = {
  html: '<p class="foam-query-empty">No results</p>',
  shape: 'empty',
};

export function renderList(
  results: ResourceView[],
  fields: SelectInput[],
  toHref: ToHref,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): QueryRender {
  if (results.length === 0) {
    return EMPTY_RESULT;
  }
  const entries = fields.map(normalizeSelectEntry);
  const items = results
    .map(r => {
      const parts = entries
        .map(({ field }) => {
          const value = r[field];
          if (field === 'title') {
            return noteLink(titleText(value, r.uri.path), r.uri, toHref);
          }
          return renderCell(field, value, r, renderMarkdown, context);
        })
        .filter(Boolean);
      return parts.length > 0 ? `<li>${parts.join(' · ')}</li>` : null;
    })
    .filter((item): item is string => item !== null)
    .join('\n');
  if (items.length === 0) {
    return EMPTY_RESULT;
  }
  return {
    html: `<ul class="foam-query-results">\n${items}\n</ul>`,
    shape: 'list',
  };
}

export function renderTable(
  results: ResourceView[],
  fields: SelectInput[],
  toHref: ToHref,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): QueryRender {
  if (results.length === 0) {
    return EMPTY_RESULT;
  }
  const entries = fields.map(normalizeSelectEntry);
  const headers = entries
    .map(e => `<th>${escapeHtml(e.label)}</th>`)
    .join('');
  const rows = results
    .map(r => {
      const cells = entries
        .map(
          ({ field }) =>
            `<td>${cellValue(
              field,
              r[field],
              r,
              toHref,
              renderMarkdown,
              context
            )}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n');
  return {
    html:
      `<table class="foam-query-results">\n` +
      `<thead><tr>${headers}</tr></thead>\n` +
      `<tbody>\n${rows}\n</tbody>\n` +
      `</table>`,
    shape: 'table',
  };
}

export function renderCount(results: ResourceView[]): QueryRender {
  const n = results.length;
  return {
    html: `<span class="foam-query-results">${n} note${
      n === 1 ? '' : 's'
    }</span>`,
    shape: 'count',
  };
}

/**
 * Renders query results as HTML based on the descriptor's format.
 */
export function renderResults(
  results: ResourceView[],
  descriptor: QueryDescriptor,
  toHref: ToHref,
  renderMarkdown?: MarkdownRenderer,
  context?: RenderContext
): QueryRender {
  const format =
    descriptor.format ??
    (descriptor.select && descriptor.select.length > 1 ? 'table' : 'list');
  switch (format) {
    case 'table':
      return renderTable(
        results,
        descriptor.select ?? DEFAULT_SELECT,
        toHref,
        renderMarkdown,
        context
      );
    case 'count':
      return renderCount(results);
    default:
      return renderList(
        results,
        descriptor.select ?? DEFAULT_LIST_SELECT,
        toHref,
        renderMarkdown,
        context
      );
  }
}

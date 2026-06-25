/*global markdownit:readonly*/

/**
 * Wraps every rendered standard markdown `<table>` in a horizontally-scrollable
 * container so the table itself can take 100% of the available width while
 * still degrading gracefully on narrow viewports.
 *
 * Implementation: override `table_open` / `table_close` to bracket the table
 * with `<div class="report-table-wrap">`. Tables emitted by `foam-query`'s
 * fence rule bypass `table_open`/`table_close` entirely — they're handled by
 * the report's `onDidRender` hook in [render-report.ts](./render-report.ts),
 * which wraps them in `.report-query-result` instead.
 */
export function installTableWrapping(md: markdownit): void {
  const wrapOpen = '<div class="report-table-wrap">';
  const wrapClose = '</div>';

  const originalOpen =
    md.renderer.rules.table_open ??
    function (tokens: any, idx: any, opts: any, _env: any, self: any) {
      return self.renderToken(tokens, idx, opts);
    };
  const originalClose =
    md.renderer.rules.table_close ??
    function (tokens: any, idx: any, opts: any, _env: any, self: any) {
      return self.renderToken(tokens, idx, opts);
    };

  md.renderer.rules.table_open = function (tokens, idx, opts, env, self) {
    return wrapOpen + originalOpen(tokens, idx, opts, env, self);
  };
  md.renderer.rules.table_close = function (tokens, idx, opts, env, self) {
    return originalClose(tokens, idx, opts, env, self) + wrapClose;
  };
}

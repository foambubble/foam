/*global markdownit:readonly*/

import { FoamWorkspace } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { Logger } from '@foam/core';
import { renderDqlQuery } from '@foam/core';
import { renderJsQuery } from '@foam/core';
import { escapeHtml } from '@foam/core';
import { requiresSource } from '@foam/core';
import type { FoamQueryOptions } from './foam-query-options';

// Web-extension twin of `foam-query-renderer.ts`. The full version reads note
// source from disk via `readFileSync` to support `body` / `content` /
// `section[...]` fields; that capability is unavailable in the browser host.
// Queries still work — those fields render as a "not supported" warning, and
// every non-source field renders normally.

// Pulls field names out of a YAML-ish `select:` (either inline `[a, b]` or
// block-sequence `- a\n  - b`) without a full YAML parse. Pure heuristics —
// we only need to know whether *any* source-derived field was selected so we
// can prepend the warning.
function selectMentionsSourceField(content: string): boolean {
  // Strip line continuations and pick out anything that looks like a token
  // inside a `select:` block. Quoted fields (e.g. 'section[X]') are caught by
  // the same scan.
  const tokens = content.match(/(?:^|[\s,\[\-'"])([A-Za-z][\w.\-]*(?:\[[^\]]*\])?)/g);
  if (!tokens) return false;
  return tokens.some(t => requiresSource(t.replace(/^[\s,\[\-'"]+/, '')));
}

const WEB_SOURCE_FIELD_WARNING = `<div class="foam-query-warning">
  <strong>body</strong>, <strong>content</strong>, and <strong>section[Label]</strong> are not supported in VS Code Web — they need to read note source from disk. Other fields render normally.
</div>`;

export function markdownItFoamQuery(
  md: markdownit,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  options: FoamQueryOptions
): markdownit {
  const { isTrusted, toHref, getCurrentResource, onDidRender } = options;

  const defaultFence: any =
    md.renderer.rules.fence ??
    ((tokens: any, idx: any, options: any, _env: any, self: any) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();

    if (info !== 'foam-query' && info !== 'foam-query-js') {
      return defaultFence(tokens, idx, options, env, self);
    }

    try {
      const prefix = selectMentionsSourceField(token.content)
        ? WEB_SOURCE_FIELD_WARNING
        : '';
      const queryOpts = {
        workspace,
        graph,
        trusted: isTrusted(),
        toHref,
        currentResource: getCurrentResource?.()?.uri ?? null,
      };
      const { html: inner, shape } =
        info === 'foam-query'
          ? renderDqlQuery(token.content, queryOpts)
          : renderJsQuery(token.content, queryOpts);
      const html = prefix + inner;
      return onDidRender ? onDidRender({ info, html, shape }) : html;
    } catch (e) {
      Logger.error(`[foam-query] error rendering ${info} block`, e);
      const html = `<div class="foam-query-error">Query error: ${escapeHtml(
        String(e)
      )}</div>`;
      return onDidRender ? onDidRender({ info, html, shape: 'error' }) : html;
    }
  };

  return md;
}

export default markdownItFoamQuery;

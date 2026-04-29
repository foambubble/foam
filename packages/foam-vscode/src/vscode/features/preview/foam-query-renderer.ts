/*global markdownit:readonly*/

import { FoamWorkspace } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { Logger } from '@foam/core';
import { renderDqlQuery } from '@foam/core';
import { renderJsQuery } from '@foam/core';
import { escapeHtml } from '@foam/core';
import { Resource } from '@foam/core';

export function markdownItFoamQuery(
  md: markdownit,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  options: {
    isTrusted: () => boolean;
    toRelativePath: (path: string) => string;
    getCurrentResource?: () => Resource | null;
  }
): markdownit {
  const { isTrusted, toRelativePath, getCurrentResource } = options;

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
      return info === 'foam-query'
        ? renderDqlQuery(
            token.content,
            workspace,
            graph,
            isTrusted(),
            toRelativePath,
            getCurrentResource?.()?.uri ?? null
          )
        : renderJsQuery(
            token.content,
            workspace,
            graph,
            isTrusted(),
            toRelativePath,
            getCurrentResource?.()?.uri ?? null
          );
    } catch (e) {
      Logger.error(`[foam-query] error rendering ${info} block`, e);
      return `<div class="foam-query-error">Query error: ${escapeHtml(
        String(e)
      )}</div>`;
    }
  };

  return md;
}

export default markdownItFoamQuery;

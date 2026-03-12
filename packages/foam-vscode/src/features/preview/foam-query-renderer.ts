/*global markdownit:readonly*/

import { FoamWorkspace } from '../../core/model/workspace';
import { FoamGraph } from '../../core/model/graph';
import { Logger } from '../../core/utils/log';
import { renderDqlQuery } from '../../core/query/dql';
import { renderJsQuery } from '../../core/query/js';
import { escapeHtml } from '../../core/query/html';

export function markdownItFoamQuery(
  md: markdownit,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  options: {
    isTrusted: () => boolean;
    toRelativePath: (path: string) => string;
  }
): markdownit {
  const { isTrusted, toRelativePath } = options;

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
            toRelativePath
          )
        : renderJsQuery(
            token.content,
            workspace,
            graph,
            isTrusted(),
            toRelativePath
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

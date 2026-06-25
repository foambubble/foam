/*global markdownit:readonly*/

// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';
import { FoamWorkspace } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { Logger } from '@foam/core';
import { renderDqlQuery } from '@foam/core';
import { renderJsQuery } from '@foam/core';
import { escapeHtml } from '@foam/core';
import { Resource } from '@foam/core';
import { URI } from '@foam/core';
import { SourceReader } from '@foam/core';
import { withLinksRelativeToWorkspaceRoot } from './wikilink-embed';
import { FoamQueryOptions } from './foam-query-options';

export type { FoamQueryOptions } from './foam-query-options';

export function markdownItFoamQuery(
  md: markdownit,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  options: FoamQueryOptions
): markdownit {
  const {
    isTrusted,
    toHref,
    getCurrentResource,
    createInnerMd,
    parser,
    renderContext,
    onDidRender,
  } = options;

  // Synchronous read: the markdown-it fence rule is sync but `IDataStore.read`
  // is async, so source-derived fields are limited to local file URIs — same
  // constraint the embed plugin lives with.
  const readSource: SourceReader =
    options.readSource ??
    ((uri: URI): string | null => {
      try {
        return readFileSync(uri.toFsPath()).toString();
      } catch (e) {
        Logger.warn(`[foam-query] failed to read source for ${uri.path}: ${e}`);
        return null;
      }
    });

  const renderMarkdown = createInnerMd
    ? (text: string, opts?: { sourceUri?: URI }): string => {
        const sourceUri = opts?.sourceUri;
        // A `[[link]]` from note X must resolve against X, not the page
        // hosting the query — rewrite to absolute paths before rendering.
        let toRender = text;
        if (parser && sourceUri) {
          try {
            toRender = withLinksRelativeToWorkspaceRoot(
              sourceUri,
              text,
              parser,
              workspace
            );
          } catch (e) {
            Logger.warn(
              `[foam-query] link rewrite failed for ${sourceUri.path}: ${e}`
            );
          }
        }
        return createInnerMd().render(toRender);
      }
    : undefined;

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
      const queryOpts = {
        workspace,
        graph,
        trusted: isTrusted(),
        toHref,
        currentResource: getCurrentResource?.()?.uri ?? null,
        readSource,
        renderMarkdown,
        context: renderContext,
      };
      const { html, shape } =
        info === 'foam-query'
          ? renderDqlQuery(token.content, queryOpts)
          : renderJsQuery(token.content, queryOpts);
      return onDidRender
        ? onDidRender({ info, html, shape })
        : html;
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

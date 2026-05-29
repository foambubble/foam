/*global markdownit:readonly*/

import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { Foam } from '@foam/core';
import { default as markdownItFoamTags } from './tag-highlight';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import { default as escapeWikilinkPipes } from './escape-wikilink-pipes';
import { default as markdownItBlockAnchorIds } from './block-anchor-ids';
import { default as markdownItFoamQuery } from './foam-query-renderer';
import markdownItFootnote from 'markdown-it-footnote';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { URI } from '@foam/core';
import { createRenderContext } from '@foam/core';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  // Refresh the markdown preview whenever the workspace changes so that
  // foam-query embed blocks show up-to-date results in real time.
  context.subscriptions.push(
    foam.workspace.onDidAdd(() =>
      vscode.commands.executeCommand('markdown.preview.refresh')
    ),
    foam.workspace.onDidUpdate(() =>
      vscode.commands.executeCommand('markdown.preview.refresh')
    ),
    foam.workspace.onDidDelete(() =>
      vscode.commands.executeCommand('markdown.preview.refresh')
    )
  );

  return {
    extendMarkdownIt: (md: markdownit) => {
      const ws = foam.workspace;
      const graph = foam.graph;
      const parser = foam.services.parser;

      // One render context per `extendMarkdownIt` call — shared between the
      // embed and query plugins so embed↔query cycles get caught.
      const renderContext = createRenderContext();

      // For `$current` in foam-query and for self-fragment embeds. The
      // context's top wins so a foam-query inside note B's body sees B,
      // not the active editor's note.
      const getCurrentResource = () => {
        const stack = renderContext.current();
        if (stack.length > 0) {
          return ws.find(stack[stack.length - 1]) ?? null;
        }
        const editor = vscode.window.activeTextEditor;
        return editor ? ws.find(fromVsCodeUri(editor.document.uri)) : null;
      };

      // Inherit the outer md's html setting (VS Code tracks
      // `markdown.preview.unsafe` there) so source-derived cells respect the
      // same lockdown as the rest of the preview.
      const outerHtmlOption = (md as { options?: { html?: boolean } }).options
        ?.html ?? true;

      const buildFoamPipeline = (target: markdownit): markdownit => {
        let r = escapeWikilinkPipes(target);
        r = r.use(markdownItFootnote);
        r = markdownItWikilinkEmbed(r, ws, parser, {
          getCurrentResource,
          createInnerMd: () =>
            buildFoamPipeline(MarkdownIt({ html: outerHtmlOption })),
          renderContext,
        });
        r = markdownItFoamTags(r, ws);
        r = markdownItWikilinkNavigation(r, ws);
        r = markdownItRemoveLinkReferences(r, ws);
        r = markdownItBlockAnchorIds(r);
        r = markdownItFoamQuery(r, ws, graph, {
          isTrusted: () => vscode.workspace.isTrusted,
          toRelativePath: (uriPath: string) =>
            vscode.workspace.asRelativePath(
              toVsCodeUri(URI.file(uriPath)),
              false
            ),
          getCurrentResource,
          createInnerMd: () =>
            buildFoamPipeline(MarkdownIt({ html: outerHtmlOption })),
          parser,
          renderContext,
        });
        return r;
      };

      return buildFoamPipeline(md);
    },
  };
}

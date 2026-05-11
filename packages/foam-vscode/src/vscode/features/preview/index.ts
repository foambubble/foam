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

      // Used to resolve self-referencing embeds (![[#section]], ![[#^blockid]]).
      // The active text editor is the most reliable signal when the user
      // initiated the preview — clicking into the preview panel can clear
      // `activeTextEditor`, but that's a secondary case the user can work
      // around by clicking back into the source.
      const getCurrentResource = () => {
        const editor = vscode.window.activeTextEditor;
        return editor ? ws.find(fromVsCodeUri(editor.document.uri)) : null;
      };

      // Factory used by wikilink-embed to render embedded note content in a
      // fresh markdown-it instance — avoids re-entering the outer `md`
      // mid-render (which corrupts stateful plugins like VS Code's
      // source-map). The inner instance gets the same Foam plugin pipeline.
      const buildFoamPipeline = (target: markdownit): markdownit => {
        let r = escapeWikilinkPipes(target);
        r = r.use(markdownItFootnote);
        r = markdownItWikilinkEmbed(r, ws, parser, getCurrentResource, () =>
          // html: true so the card/inline embed wrappers (which inject
          // `<div class="embed-container-note">...`) survive the inner
          // render as raw HTML rather than being escaped to text.
          buildFoamPipeline(MarkdownIt({ html: true }))
        );
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
        });
        return r;
      };

      return buildFoamPipeline(md);
    },
  };
}

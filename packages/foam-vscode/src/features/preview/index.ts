/*global markdownit:readonly*/

import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { default as markdownItFoamTags } from './tag-highlight';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import { default as escapeWikilinkPipes } from './escape-wikilink-pipes';
import { default as markdownItBlockAnchorIds } from './block-anchor-ids';
import { default as markdownItFoamQuery } from './foam-query-renderer';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { URI } from '../../core/model/uri';

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
      // activeTextEditor is the best available proxy for the document being previewed.
      const getCurrentResource = () => {
        const editor = vscode.window.activeTextEditor;
        return editor ? ws.find(fromVsCodeUri(editor.document.uri)) : null;
      };
      let result = escapeWikilinkPipes(md);
      result = markdownItWikilinkEmbed(result, ws, parser, getCurrentResource);
      result = markdownItFoamTags(result, ws);
      result = markdownItWikilinkNavigation(result, ws);
      result = markdownItRemoveLinkReferences(result, ws);
      result = markdownItBlockAnchorIds(result);
      result = markdownItFoamQuery(result, ws, graph, {
        isTrusted: () => vscode.workspace.isTrusted,
        toRelativePath: (uriPath: string) =>
          vscode.workspace.asRelativePath(
            toVsCodeUri(URI.file(uriPath)),
            false
          ),
      });
      return result;
    },
  };
}

/*global markdownit:readonly*/

import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { default as markdownItFoamTags } from './tag-highlight';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import { default as escapeWikilinkPipes } from './escape-wikilink-pipes';
import { default as markdownItBlockAnchorIds } from './block-anchor-ids';
import { fromVsCodeUri } from '../../utils/vsc-utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  return {
    extendMarkdownIt: (md: markdownit) => {
      const ws = foam.workspace;
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
      return result;
    },
  };
}

/*global markdownit:readonly*/

import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { default as markdownItFoamTags } from './tag-highlight';
import { markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import { blockIdHtmlPlugin } from '../../core/services/markdown-blockid-html-plugin';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  return {
    extendMarkdownIt: (md: markdownit) => {
      // No longer injecting custom-anchor-navigation.js as we are moving to native link handling.

      return [
        markdownItWikilinkEmbed,
        markdownItFoamTags,
        markdownItWikilinkNavigation,
        markdownItRemoveLinkReferences,
        blockIdHtmlPlugin, // Add the blockIdHtmlPlugin here
      ].reduce(
        (acc, extension) =>
          extension(acc, foam.workspace, foam.services.parser),
        md
      );
    },
  };
}

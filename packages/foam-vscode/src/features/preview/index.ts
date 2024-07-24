/*global markdownit:readonly*/

import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { default as markdownItFoamTags } from './tag-highlight';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import foamQuery from './query-embed';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  return {
    extendMarkdownIt: (md: markdownit) => {
      return [
        markdownItWikilinkEmbed,
        markdownItFoamTags,
        markdownItWikilinkNavigation,
        markdownItRemoveLinkReferences,
        foamQuery,
      ].reduce(
        (acc, extension) =>
          extension(acc, foam.workspace, foam.services.parser),
        md
      );
    },
  };
}

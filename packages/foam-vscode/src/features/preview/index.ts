/*global markdownit:readonly*/

import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { default as markdownItFoamTags } from './tag-highlight';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import { default as markdownItTaskListsPlugin } from './task-lists';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  return {
    extendMarkdownIt: (md: markdownit) => {
      return [
        markdownItTaskListsPlugin,
        markdownItWikilinkEmbed,
        markdownItFoamTags,
        markdownItWikilinkNavigation,
        markdownItRemoveLinkReferences,
      ].reduce(
        (acc, extension) =>
          extension(acc, foam.workspace, foam.services.parser),
        md
      );
    },
  };
}

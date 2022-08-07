import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { Foam } from '../../core/model/foam';
import markdownItFoamTags from './tag-highlight';
import markdownItWikilinkNavigation from './wikilink-navigation';
import markdownItRemoveLinkReferences from './remove-wikilink-references';
import markdownItWikilinkEmbed from './wikilink-embed';

const feature: FoamFeature = {
  activate: async (
    _context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    return {
      extendMarkdownIt: (md: markdownit) => {
        return [
          markdownItWikilinkEmbed,
          markdownItFoamTags,
          markdownItWikilinkNavigation,
          markdownItRemoveLinkReferences,
        ].reduce((acc, extension) => extension(acc, foam.workspace), md);
      },
    };
  },
};
export default feature;

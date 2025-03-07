/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import { ResourceParser } from '../../core/model/note';
import { FoamWorkspace } from '../../core/model/workspace';

export const WIKILINK_EMBED_REGEX =
  /((?:(?:full|content)-(?:inline|card)|full|content|inline|card)?!\[\[[^[\]]+?\]\])/;

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace,
  parser: ResourceParser
) => {
  return md.use(markdownItRegex, {
    name: 'embed-wikilinks',
    regex: WIKILINK_EMBED_REGEX,
    replace: (wikilinkItem: string) => {
      return `
      <div class="foam-embed-not-supported-warning">
        Embed not supported in web mode: ${wikilinkItem}
      </div>
`;
    },
  });
};

export default markdownItWikilinkEmbed;

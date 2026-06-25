/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import { ResourceParser } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import type { WikilinkEmbedOptions } from './wikilink-embed';

export const WIKILINK_EMBED_REGEX =
  /((?:(?:full|content)-(?:inline|card)|full|content|inline|card)?!\[\[[^[\]]+?\]\])/;
export const CONFIG_EMBED_NOTE_TYPE = 'preview.embedNoteType';

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace,
  parser: ResourceParser,
  _options?: WikilinkEmbedOptions
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

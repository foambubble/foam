/*global markdownit:readonly*/

import { ResourceParser } from 'packages/foam-vscode/src/core/model/note';
import { FoamWorkspace } from 'packages/foam-vscode/src/core/model/workspace';

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace,
  parser: ResourceParser
) => {
  return md;
};

import { ResourceParser } from '../../core/model/note';
import { FoamWorkspace } from '../../core/model/workspace';

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace,
  parser: ResourceParser
) => {
  return md;
};

export default markdownItWikilinkEmbed;

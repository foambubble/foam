/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
import { Logger } from '../../core/utils/log';

export const markdownItFoamTags = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'foam-tags',
    regex: /(?<=^|\s)(#[0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/u,
    replace: (tag: string) => {
      try {
        return getFoamTag(tag);
      } catch (e) {
        Logger.error(
          `Error while creating link for ${tag} in Preview panel`,
          e
        );
        return getFoamTag(tag);
      }
    },
  });
};

// Commands can't be run in the preview (see https://github.com/microsoft/vscode/issues/102532)
// for we just return the tag as a span
const getFoamTag = (content: string) =>
  `<span class='foam-tag'>${content}</span>`;

export default markdownItFoamTags;

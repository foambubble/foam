/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { isNone } from '../../core/utils';

export const foamQuery = (md: markdownit, workspace: FoamWorkspace) => {
  return md.use(markdownItRegex, {
    name: 'foam-query',
    regex: /(\?\?\?query\s[\s\S]*\s\?\?\?)/, // /(\?\?\?[0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*\s*)/u,
    replace: (query: string) => {
      try {
        Logger.error(`Query: ${query}`);
        const resource = workspace.find(query);
        if (isNone(resource)) {
          let content = getFoamQuery(query);
          let html = md.render(content);
          return html;
        }
      } catch (e) {
        Logger.error(
          `Error while creating link for ${query} in Preview panel`,
          e
        );
        return getFoamQuery(query);
      }
    },
  });
};

const getFoamQuery = (content: string) =>
  `<pre><code><span class="foam-query">${content}</span></code></pre>`;

export default foamQuery;

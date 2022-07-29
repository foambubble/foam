import markdownItRegex from 'markdown-it-regex';
import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { isNone, isSome } from '../../utils';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { Resource } from '../../core/model/note';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Range } from '../../core/model/range';
import { isEmpty } from 'lodash';
import { getFoamVsCodeConfig } from '../../services/config';
// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';

export const markdownItWikilinkNavigation = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    regex: /\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
        const { target, alias } = MarkdownLink.analyzeLink({
          rawText: '[[' + wikilink + ']]',
          type: 'wikilink',
          range: Range.create(0, 0),
        });
        const label = isEmpty(alias) ? target : alias;

        const resource = workspace.find(target);
        if (isNone(resource)) {
          return getPlaceholderLink(label);
        }

        const link = vscode.workspace.asRelativePath(toVsCodeUri(resource.uri));
        return `<a class='foam-note-link' title='${resource.title}' href='/${link}' data-href='/${link}'>${label}</a>`;
      } catch (e) {
        Logger.error(
          `Error while creating link for [[${wikilink}]] in Preview panel`,
          e
        );
        return getPlaceholderLink(wikilink);
      }
    },
  });
};

const getPlaceholderLink = (content: string) =>
  `<a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">${content}</a>`;

export default markdownItWikilinkNavigation;

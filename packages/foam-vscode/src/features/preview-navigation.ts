import * as vscode from 'vscode';
import markdownItRegex from 'markdown-it-regex';
import { Foam, FoamWorkspace, Logger, URI } from 'foam-core';
import { FoamFeature } from '../types';
import fp from 'lodash/fp';

const feature: FoamFeature = {
  activate: async (
    _context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    return {
      extendMarkdownIt: (md: markdownit) => {
        const markdownItExtends = fp.compose(
          markdownItWithFoamLinks,
          markdownItWithFoamTags
        );
        return markdownItExtends(md, foam.workspace);
      },
    };
  },
};

export const markdownItWithFoamLinks = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    regex: /\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
        const resource = workspace.find(wikilink);
        if (resource == null) {
          return getPlaceholderLink(wikilink);
        }
        return `<a class='foam-note-link' title='${
          resource.title
        }' href='${URI.toFsPath(resource.uri)}'>${wikilink}</a>`;
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

export const markdownItWithFoamTags = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'foam-tags',
    regex: /(#\w+)/,
    replace: (tag: string) => {
      try {
        const resource = workspace.find(tag);
        if (resource == null) {
          return getFoamTag(tag);
        }
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

const getFoamTag = (content: string) =>
  `<span class='foam-tag'>${content}</span>`;

export default feature;
